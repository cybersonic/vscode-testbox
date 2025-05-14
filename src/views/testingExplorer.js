
const vscode = require("vscode");
const { parseTestBlocks } = require('../utils/bddParser');
const { testResultHandler, parseTestResults, getAllSpecsFromTest, updateTestWithResults } = require("../utils/resultParser");
const { LOG } = require("../utils/logger");

const testFileGlob = '**/*{Spec,Test,Tests}.cfc'; //<-- should be configurable

/**
 * See https://code.visualstudio.com/api/extension-guides/testing
 */

// Lookup Maps: Used to store extra data about the tests and map to files
let testData = new WeakMap();
let fileTestItems = new WeakMap();

// Classes
class TestBundle {
    name = "";
    path = "";
    directory = "";
    runnerUrl = "";
    children = [];

    constructor(path, name, runnerUrl, block) {
        // Things we need to construct the URL and to classify the test
        this.name = name;
        this.path = path;
        this.directory = name.split('.').slice(0, -1).join('.');
        this.runnerUrl = runnerUrl;
        // this.block = block || [];

        for(var block of block) {
           this.children.push(
            new TestSuite(block, this, this)
           )
        }

    }

    getJSONReporterURL() {

        const bundleName = this.name;
        const dirName = this.directory;
        return `${this.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
    }
    getSimpleReporterURL() {
        const runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl");
        if (!runnerUrl) {
            vscode.window.showErrorMessage("No Testbox Runner URL configured in settings.");
            return;
        }
        const bundleName = this.name;
        const dirName = this.directory;
        return `${runnerUrl}?reporter=simple&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
    }

    async getText() {
        const doc = await vscode.workspace.openTextDocument(this.path);
        return doc.getText();
    }

    //     const testURLSimple = `${runnerUrl}?reporter=simple&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
    //     // These are the root items. in theory all would be Specs?
    //     const testItem = controller.createTestItem(testUrl, bundleName, file);
}

class TestSuite {
    // id = "";
    name = "";
    title = "";
    fullLine = "";
    startOffset = "";
    endOffset = "";
    range = "";
    bundle = "";
    parent = "";
    skipped = false;
    children = [];

    constructor(block, bundle, parent) {
        this.name = block.name;
        this.fullLine = block.fullLine;
        this.title = block.title;
        this.startOffset = block.startOffset;
        this.endOffset = block.endOffset;
        this.range = block.range;
        this.skipped = block.skipped || false;
        this.bundle = bundle;
        this.parent = parent;
      
        for(var block of block.children) {
            if(block.name === "it") {
                this.children.push(new TestSpec(block, bundle, this));
            }
            else {
                this.children.push(new TestSuite(block, bundle, this));
            }
           
        }
    }


    getID() {
        return this.bundle.name + "suite" + this.title;
    }
    getJSONReporterURL() {

        const bundleName = this.bundle.name;
        const dirName = this.bundle.directory;
        return `${this.bundle.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testSuite=${encodeURIComponent(this.name)}`;
    }
    getURI(){
        return this.bundle.path;
    }
}

class TestSpec {
    id = "";
    name = "";
    fullLine = "";
    startOffset = "";
    endOffset = "";
    range = "";
    children = "";
    parent = "";
    bundle = "";
    constructor(block, bundle, parent) {
        this.name = block.name;
        this.fullLine = block.fullLine;
        this.title = block.title;
        this.startOffset = block.startOffset;
        this.endOffset = block.endOffset;
        this.range = block.range;
        this.skipped = block.skipped || false;
        this.children = block.children || [];
        this.parent = parent;
        this.bundle = bundle;
        this.id = `${this.bundle.id}&testSpecs=${encodeURIComponent(this.title)}`
    }

    getID() {
        return this.parent.getID() + "spec" + this.title;
    }
    getJSONReporterURL() {

        const dirName = this.bundle.directory;
        return `${this.bundle.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testSpec=${encodeURIComponent(this.name)}`;
    }
    getURI(){
        return this.bundle.path;
    }
}

class TestBoxTestItem {
    type = "";
    bundle = "";
    directory = "";
    jsonURL = "";
    simpleURL = "";
    URI = "";
    constructor(type, bundle, directory, jsonURL, simpleURL, URI) {
        // Things we need to construct the URL and to classify the test
        this.type = type;
        this.bundle = bundle;
        this.directory = directory;
        this.jsonURL = jsonURL;
        this.simpleURL = simpleURL;
        this.URI = URI;
    }
}

// Given a file, I want to create a TestBoxTestItem and a Tree ITem.
/**
 * Creates and configures the CFML testing view controller.
 *
 * This function initializes a test controller for CFML tests using the vscode.tests API,
 * sets up a run profile that triggers test execution via the runTestsViaURL function,
 * and establishes a filesystem watcher to monitor test file changes. When test files are
 * created, changed, or deleted, the tests are rediscovered via the discoverTests function.
 *
 * @returns {Object} An object containing:
 *   - controller: The created test controller for managing CFML tests.
 *   - watcher: A filesystem watcher that monitors the test files and triggers test discovery on changes.
 */
function createTestingViewController() {
    const controller = vscode.tests.createTestController('cfmlTestController', 'CFML Tests');

    // Create a run profile that runs tests
    controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
        return runHandler(request, token, controller);
    }, true, undefined, true);
    // controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
    //     runTestsViaURL(request, token, controller);
    // });

    controller.createRunProfile("Open Test URL",
        vscode.TestRunProfileKind.Debug,
        (request, token) => {
            for (const test of request.include ?? []) {
                const testMeta = testData.get(test);
                const url = testMeta.simpleURL;
                if (url) vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }
    );

    const watcher = vscode.workspace.createFileSystemWatcher(testFileGlob);

    watcher.onDidCreate(file => discoverTests(controller));
    watcher.onDidChange(file => {
        console.log(`File ${file} changed`);
        discoverTests(controller)
    });
    watcher.onDidDelete(file => {
        console.log(`File ${file} deleted`);
        // Should simply rmeove the test from the test tree
        discoverTests(controller)
    });


    const settingsWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        discoverTests(controller);
    })

    // Populate the controller with on creation
    discoverTests(controller);

    return { controller, watcher, settingsWatcher };
}

/**
 * Discovers test files and adds them to the test controller.
 *
 * This function clears out any previous test items from the controller,
 * retrieves the list of test files based on the specified glob pattern
 * and excluded paths from the workspace configuration, and then maps
 * each file path to a test name before adding it to the controller.
 *
 * @param {vscode.TestController} controller - The test controller to which discovered tests will be added.
 * @returns {Promise<void>} A promise that resolves when the test discovery is complete.
 */
async function discoverTests(controller) {
    // TODO: manage if we are changing things.
    // Clear out previous items
    controller.items.replace([]);
    let runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl");
    let bundles = vscode.workspace.getConfiguration("testbox").get("bundles"); //??

    const excludedPaths = vscode.workspace.getConfiguration("testbox").get("excludedPaths");
    const excludedPackagesConfig = vscode.workspace.getConfiguration("testbox").get("excludedPackages", "") || "";
    const excludedPackagesArray = excludedPackagesConfig.split(",").map(pkg => pkg.trim()).filter(pkg => pkg !== "");


    // Files are at the top of the test tree, so a bundle == file == a top root item. WE can create sub children etc. but those are at the top 
    const files = await vscode.workspace.findFiles(testFileGlob, excludedPaths);
    foundfiles: for (const file of files) {
        const mappedPath = applyPathMappings(vscode.workspace.asRelativePath(file.fsPath));
        const bundleName = convertToDottedPackageName(mappedPath);
        // Check if they are excluded
        for (const expackage of excludedPackagesArray) {
            if (bundleName.startsWith(expackage)) {
                LOG.debug(`Skipping ${bundleName} as it is in the excluded packages`);
                continue foundfiles;
            }
        }

        //Create  and parse the test Item

        addFileToTestTree(controller, file, bundleName);
    }

    return;


    // This will take some time

    foundfiles: for (const file of files) {
        const mappedPath = applyPathMappings(vscode.workspace.asRelativePath(file.fsPath));
        const bundleName = convertToDottedPackageName(mappedPath);
        const dirName = bundleName.split('.').slice(0, -1).join('.');

        for (const expackage of excludedPackagesArray) {
            if (bundleName.startsWith(expackage)) {
                LOG.debug(`Skipping ${bundleName} as it is in the excluded packages`);
                continue foundfiles;
            }
        }

        // Check againsgt bundles
        // we need to do ignores and labels. 
        const testUrl = `${runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
        const testURLSimple = `${runnerUrl}?reporter=simple&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
        // These are the root items. in theory all would be Specs?
        const testItem = controller.createTestItem(testUrl, bundleName, file);
        testItem.description = `Bundle`;
        testItem.tags = ["bundle"];

        const doc = await vscode.workspace.openTextDocument(file);
        // This sets the bundle start to right at the top of the file, rather than at the first `component` or `function` item
        // This is a bit of a hack, but it works for now
        testItem.range = new vscode.Range(0, 0, doc.lineCount - 1, 0);


        // Save it to our store. 
        testData.set(testItem, new TestBoxTestItem("bundle", bundleName, dirName, testUrl, testURLSimple, file));
        testItem.canResolveChildren = false;

        const bddTree = parseTestBlocks(doc.getText(), 0);
        for (const block of bddTree) {
            addChildTests(controller, doc, testItem, block, testItem, bundleName, dirName);
        }

        // controller.resolveHandler = async (item) => {

        //     if (item !== null && item !== undefined && item.uri !== null && item.uri !== undefined) {
        //         const document = await vscode.workspace.openTextDocument(item.uri)
        //         const bddTree = parseTestBlocks(document.getText(), 0);

        //         for (const block of bddTree) {
        //             addChildTests(controller, document, item, block, item, bundleName, dirName);
        //         }
        //     }
        // }
        controller.items.add(testItem);
    }
}

async function addFileToTestTree(controller, file, bundleName) {
    // Root bundle
    // Probably a bit late, we shouild do it for all.
    const runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl");
    if (!runnerUrl) {
        vscode.window.showErrorMessage("No Testbox Runner URL configured in settings.");
        return;
    }

    const doc = await vscode.workspace.openTextDocument(file);
    const bddTree = parseTestBlocks(doc.getText(), 0);
    const testBundle = new TestBundle(file, bundleName, runnerUrl, bddTree);
    const testItem = controller.createTestItem(testBundle.getJSONReporterURL(), testBundle.name, testBundle.path);
    testItem.description = `Bundle`;
    testItem.tags = ["bundle"];
    testItem.canResolveChildren = false;
    // This sets the bundle start to right at the top of the file, rather than at the first `component` or `function` item
    testItem.range = new vscode.Range(0, 0, doc.lineCount - 1, 0);
    // Save it to our store. 
    // testData.set(testItem, new TestBoxTestItem("bundle", bundleName, testBundle.directory, testUrl, testURLSimple, file));
    testItem.canResolveChildren = false;

    for(const suiteOrSpec of testBundle.children) {
        addSuiteOrSpec(testItem, suiteOrSpec, controller);
    }
    


    // This just keeps a track of the file -> toTestItem, good for deleting tests
    fileTestItems.set(file, testItem);
    // This is each item, so we can lookup extraData from the testItem, in this case, it's a bundle
    testData.set(testItem, testBundle);
    controller.items.add(testItem);
    // controller.items.add(testItem2);   
}

function addSuiteOrSpec(testItem, testModel, controller) {

    // testmode.children
    if(testModel instanceof TestSuite) {
        
            const subTest = controller.createTestItem(testModel.getID(), testModel.title, testModel.getURI());
            testItem.children.add(subTest);
            subTest.skipped = testModel.skipped || false;
            const range = testModel.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
            subTest.range = new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
            subTest.tags = ["suite"];

        if (testModel.children) {
            for(const child of testModel.children) {
                addSuiteOrSpec(subTest, child, controller);
            }
        }

        testData.set(subTest, testModel);
    }
    
    if(testModel instanceof TestSpec) {
        const subTest = controller.createTestItem(testModel.getID(), testModel.title, testModel.getURI());
        subTest.skipped = testModel.skipped || false;
        testItem.children.add(subTest);
        const range = testModel.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
        subTest.range = new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
        subTest.tags = ["spec"];

        testData.set(subTest, testModel);
    }
}

/**
 * Recursively adds child tests to the given parent test item.
 *
 * @param {object} controller - The test controller used to create new test items.
 * @param {TextDocument} document - The document where tests are defined.
 * @param {TestItem} parent - The parent test item to which the child item will be added.
 * @param {object} child - The child test object containing details like name, title, range, and potential children.
 * @param {object} root - The root test item which generates a unique identifier for the child.
 * @param {string} bundleName - The name for the test suite/specification.
 * @param {string} dirName - The dot path directory name associated with the test.
 * @param {string} file - The file path of the test.vscode.URI
 */
function addChildTests(controller, document, parent, child, root, bundleName, dirName, file) {
    // Test Suite and Test Spec
    const childtype = child.name === "it" ? "testSpecs" : "testSuites";
    const childTag = child.name === "it" ? "spec" : "suite";

    // We set the URL as the child id, it should be unique enough
    const childid = `${root.id}&${childtype}=${encodeURIComponent(child.title)}`;
    const childName = child.title;


    const subTest = controller.createTestItem(childid, childName, parent.uri);
    subTest.description = child.name === "it" ? "Spec" : "Suite";
    const range = child.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    subTest.range = new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
    subTest.tags = [childTag];

    // TODO: Need to fix this , shouldnt have empty items for simpleURL etc.
    testData.set(subTest, new TestBoxTestItem(childTag, bundleName, dirName, "", "", file));

    parent.children.add(subTest);
    if (child.children) {
        child.children.forEach(grandchild => {
            addChildTests(controller, document, subTest, grandchild, root, bundleName, dirName);
        });
    }
}


/**
 * Handles the test run request and cancellation.
 * @param {vscode.TestRunRequest} request - The test run request.
 * @param {vscode.CancellationToken} cancellation - The cancellation token.
 * 
 */
function runHandler(request, cancellation, controller) {

    if (!request.continuous) {
        return startTestRunViaURL(request, controller);
    }
    else {
        console.error("Continuous run not implemented");
        // if (request.include === undefined) {
        // 	watchingTests.set('ALL', request.profile);
        // 	cancellation.onCancellationRequested(() => watchingTests.delete('ALL'));
        // } else {
        // 	request.include.forEach(item => watchingTests.set(item, request.profile));
        // 	cancellation.onCancellationRequested(() => request.include!.forEach(item => watchingTests.delete(item)));
        // }

    }
}


/**
 * Start a test run, making a queue and running them in parallel "threads" so we dont kill the server
 * @param {vscode.TestRunRequest} request - The test run request.
 * @param {vscode.TestController} controller - The test controller.
 * @returns {Promise<void>} A promise that resolves when the tests have been run.
 */
async function startTestRunViaURL(request, controller) {

    const runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl", null);
    if (!runnerUrl) {
        vscode.window.showErrorMessage("No Testbox Runner URL configured in settings.");
        return;
    }

    let threads = vscode.workspace.getConfiguration("testbox").get("urlThreads", 10);
    if (!threads || threads === 0) {
        threads = 10;
    }
    if (threads < 1) {
        threads = 1;
    }
    const limit = limitConcurrency(threads); // Only 5 requests at a time



    console.log("Using runner URL: " + runnerUrl);
    const testqueue = [];
    // Do we do an indivual run or singular ones?
    const run = controller.createTestRun(request);

    // Add the right tests to the queue
    if (request.include) {
        request.include.forEach(test => testqueue.push(test));
    }
    else {
        controller.items.forEach(test => testqueue.push(test));
    }
    console.log({ testqueue });

    const testPromises = testqueue.forEach(test => {
        limit(
            () => runIndividualTest(test, request, run)
        )
    });

    // const testPromises = (testqueue ?? {}).map(
    //     test => limit(
    //         () => runIndividualTest(test, token, request, controller)
    //     )
    // );

    await Promise.all(testPromises);
    run.end();
    request.end();


    // Find out which tests we have to run. either request.include or controller.items

    return;

    let requestedBundles = {};
    let filteredTests = [];


    // This filters the tests
    // If we dont have an include, we are just running all the tests ??
    if (!request.include || request.include.length === 0) {
        // If we have no tests, we are running all the tests
        vscode.window.showErrorMessage("Running all tests");
        controller.items.forEach(test => {
            const testMeta = testData.get(test);
            if (testMeta.type === "bundle") {
                requestedBundles[testMeta.bundle] = true;
            }
            filteredTests.push(test);
        }
        );
    }
    else {
        for (const test of request.include) {
            const testMeta = testData.get(test);
            if (testMeta.type === "bundle") {
                requestedBundles[testMeta.bundle] = true;
            }
        }

        filteredTests = request.include.filter(test => {
            const testMeta = testData.get(test);

            // Is it a bundle
            if (testMeta.type === "bundle") {
                return true;
            }
            // If our bundle isnt listed, add ourselves
            if (!requestedBundles.hasOwnProperty(testMeta.bundle)) {
                return true;
            }

        });
    }
    //Filter the tests so if we are asking to run a bundle, we only run the bundle, rather than all the tests in the bundle






    console.log({ filteredTests });

    // const testPromises = (filteredTests ?? {}).map(
    //     test => limit(
    //         () => hitUrlAndRunTest(test, token, request, controller)
    //     )

    // );

    await Promise.all(testPromises);
    request.end();
}
function limitConcurrency(concurrency) {
    const queue = [];
    let activeCount = 0;

    const next = () => {
        if (queue.length === 0 || activeCount >= concurrency) return;
        const fn = queue.shift();
        activeCount++;
        fn().finally(() => {
            activeCount--;
            next();
        });
    };

    return fn => new Promise(resolve => {
        queue.push(() => fn().then(resolve));
        next();
    });
}
// We will need to do some kind of tree of this

async function runIndividualTest(test, request, run) {
    
    const testMeta = testData.get(test);
    const urlToRun = testMeta.getJSONReporterURL();
    const start = Date.now();

    try {
        const response = await fetch(test.id);
        run.appendOutput(`🧪: ${test.label}\r\n`);
        if (!response.ok) {
                const message = `\t🚨 HTTP error! Status: ${response.status} [${response.statusText}] [${urlToRun}]\r\n`;
                vscode.window.showErrorMessage(message);
                run.appendOutput(message);
                run.errored(test, message);
                // Nothing else to do for this test
                return;
        }
        run.passed(test, Date.now() - start);

    }
    catch (error) {
        run.appendOutput(`🧪: ${test.label}\r\n`);
        const message = `\t🚨  Error [${error.message}] [${urlToRun}]:\r\n`;
        run.errored(test, message);
        vscode.window.showErrorMessage(message);
        
        // if (error.cause.code && error.cause.code == "ECONNREFUSED") {
        //     vscode.window.showErrorMessage(`Can't reach RunnerURL [${test.id}]. Connection refused.`);
        // }
        // run.end();
        run.appendOutput(message);
        LOG.error(error.stack);
    }



    return;
    // const urlToRun = testData.get(test).getJSONReporterURL();
    // try {
    //     console.log(`Running test ${test.label} (${test.id})`);
    //     
    //     if (!response.ok) {
    //         vscode.window.showErrorMessage(`Can't reach RunnerURL [${test.id}]: HTTP error! Status: ${response.status}`);
    //         run.appendOutput(`🌎: ${test.id}\r\n`);
    //         let message = `Error running test ${test.label}: HTTP error! Status: ${response.status} [${response.statusText}]\r\n`;
    //         run.appendOutput(`Error running test ${test.label}: HTTP error! Status: ${response.status}\r\n`);
    //         run.errored(test, `HTTP error! Status: ${response.status} \r\n`);
    //         run.end();
    //         // throw new Error(`HTTP error! Status: ${response.status}`);
    //     }
    //     const results = await response.json();
    //     const testResults = parseTestResults(results);
    //     const specResults = testResults.getSpecs(); //Gets all the specs that were run
    //     const testSpecs = getAllSpecsFromTest(test); //Gets all the specs that were run

    //     // Loop through the specResults and update the testSpecs
    //     for (const spec of specResults) {
    //         for (const testSpec of testSpecs) {
    //             if (testSpec.label === spec.name) {
    //                 updateTestWithResults(testSpec, spec, run);
    //                 break;
    //             }
    //         }
    //     }


    //     // testResultHandler(test, results, run);
    //     const out = resultOutput(test, results);
    //     run.appendOutput(out);
    //     run.end();

    //     // run.appendOutput(`Result: ${JSON.stringify(json)}\r\n`);
    // } catch (error) {
    //     run.errored(test, error.message);

    //     if (error.cause.code && error.cause.code == "ECONNREFUSED") {
    //         vscode.window.showErrorMessage(`Can't reach RunnerURL [${test.id}]. Connection refused.`);
    //     }
    //     run.end();
    //     run.appendOutput(`Error running test ${test.label}: ${error.message}\r\n`);
    //     LOG.error(error.stack);

    // }
}
// TODO: move to the result Parser or a Decorator
function iconResults(resultJSON) {
    let out = "";
    let icons = {
        "passed": "✅",
        "failed": "❌",
        "skipped": "-",
        "error": "⚠️",
    }
    const totalPass = Math.max(0, Number(resultJSON.totalPass) || 0);
    const totalFail = Math.max(0, Number(resultJSON.totalFail) || 0);
    const totalSkipped = Math.max(0, Number(resultJSON.totalSkipped) || 0);
    const totalError = Number(resultJSON.totalError);

    if (totalPass <= 30 && totalPass > 0) {
        out += icons.passed.repeat(totalPass) + " ";
    }
    else if (totalPass > 0) {
        out += icons.passed + `(${totalPass}) `;
    }

    if (totalFail <= 30 && totalFail > 0) {
        out += icons.failed.repeat(totalFail) + " ";
    }
    else if (totalFail > 0) {
        out += icons.failed + `(${totalFail}) `;
    }

    if (totalError <= 30 && totalError > 0) {
        out += icons.error.repeat(totalError) + " ";
    }
    else if (totalError > 0) {
        out += icons.error + `(${totalError}) `;
    }
    else if (totalError < 0) {
        // -1 seems to be a valid error code
        out += icons.error.repeat(1) + " ";
    }


    if (totalSkipped <= 30) {
        out += icons.skipped.repeat(totalSkipped) + " ";
    }
    else if (totalSkipped > 0) {
        out += icons.skipped + `(${totalSkipped}) `;
    }


    return out.trim();
}

function resultOutput(resultJSON) {

    let out = "";
    // out += `🌎: ${test.id}\r\n`;
    // Header
    out += `\r\n`;
    out += iconResults(resultJSON);
    let tablevel = 0;
    if (resultJSON.hasOwnProperty("bundleStats")) {
        out += `\r\n`;
        // out += `Bundle Stats:\r\n`;
        tablevel++;
        for (const bundle in resultJSON.bundleStats) {
            const bundleStats = resultJSON.bundleStats[bundle];
            out += "\t".repeat(tablevel) + bundleStats.name + ": " + iconResults(bundleStats);
        }
        tablevel--;
    }

    // out += `Result: ${JSON.stringify(resultJSON)}\r\n`;
    return out;
}



/**
 * Applies path mappings to a given relative file path.
 *
 * This function retrieves path mappings from the VSCode configuration for "testbox"
 * and replaces the start of the relative file path with the corresponding target path
 * if a matching source path is found.
 *
 * @param {string} relativeFilePath - The relative file path to apply mappings to.
 * @returns {string} - The new file path after applying the mappings, or the original
 *                     relative file path if no mappings match.
 */
function applyPathMappings(relativeFilePath) {
    const mappings = vscode.workspace.getConfiguration("testbox").get("pathMappings");
    for (const mapping of mappings) {
        if (relativeFilePath.startsWith(mapping.source)) {
            // This might not be correct, just have to replace the start
            const newPath = mapping.target + relativeFilePath.slice(mapping.source.length);
            return newPath;
        }
    }
    return relativeFilePath;
}





/**
 * Converts a given file path to a test name by removing the .cfc extension
 * and replacing both forward and backslashes with dots.
 *
 * @param {string} filePath - The file path to convert.
 * @returns {string} - The converted test name.
 */
function convertToDottedPackageName(filePath) {
    // Remove the .cfc extension (case-insensitive)
    const withoutExtension = filePath.replace(/\.cfc$/i, '');
    // Replace both forward and backslashes with dots
    const dottedPath = withoutExtension.replace(/[/\\]/g, '.');
    return dottedPath;
}

module.exports = {
    createTestingViewController,
    iconResults,
    resultOutput,
    TestBundle,
    TestSuite,
    TestSpec
};