/* eslint-disable no-prototype-builtins */

const vscode = require("vscode");
// const { parseTestBlocks } = require('../utils/bddParser');
// const { getTestsFromText } = require('../utils/cftokensParser');
const {generateTreeFromText, TreeSuite, TreeSpec} = require('../utils/testTreeGenerator');
const { parseTestResults, getAllSpecsFromTest, updateTestWithResults } = require("../utils/resultParser");
const { LOG } = require("../utils/logger");
const {pMap} = require("p-map");
// import pMap from 'p-map';
// import {pMapIterable} from 'p/-map';
// const fs = require("fs");
const {drawTable} = require("../utils/table");

const path = require("path");
// const { parseLuceeExecLog, LuceeExectionReport } = require("../utils/luceeExecLogParser");

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

        for(var blockitem of block) {
           this.children.push(
            new TestSuite(blockitem, this, this)
           )
        }

    }

    getJSONReporterURL() {

        const bundleName = this.name;
        const dirName = this.directory;
        return `${this.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&bundles=${encodeURIComponent(bundleName)}`;
    }

    getSimpleReporterURL() {
        let runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl");
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
     getTestLabelPath(){
        return this.name;
    }
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
        this.name = block.type;
        // this.fullLine = block.fullLine;
        this.title = block.title;
        this.startOffset = block.offset;
        this.endOffset = block.endOffset;
        this.range = block.range || { start: { line: block.line, column: 0 }, end: { line: block.endLine, column: 0 } };
        this.skipped = block.skipped || false;
        this.bundle = bundle;
        this.parent = parent;
      
        for(var blockitem of block.children) {
            if(["it","xit"].includes(blockitem.name)) {
                this.children.push(new TestSpec(blockitem, bundle, this));
            }
            else {
                this.children.push(new TestSuite(blockitem, bundle, this));
            }
           
        }
    }


    getID() {
        return this.bundle.name + "suite" + this.title;
    }
    getJSONReporterURL() {

        // const bundleName = this.bundle.name;
        const dirName = this.bundle.directory;
        return `${this.bundle.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testSuite=${encodeURIComponent(this.title)}`;
    }
    getURI(){
        return this.bundle.path;
    }
     getTestLabelPath(){
        return this.bundle.getTestLabelPath() + ": " + this.title;
    }
}
class TestSpec {
    id = "";
    title="";
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
        return `${this.bundle.runnerUrl}?reporter=JSON&recurse=false&directory=${dirName}&testSpec=${encodeURIComponent(this.title)}`;
    }
    getURI(){
        return this.bundle.path;
    }
    getTestLabelPath(){
        return this.bundle.getTestLabelPath() + ":" + this.title + "\r\n\t" + this.getJSONReporterURL();
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

    // controller.resolveHandler = (item) => {
    //     // So we could do some kind of lazy loading here. 

    // });

    // Create a run profile that runs tests
    controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
        return runHandler(request, token, controller);
    }, true, undefined, false);
    // controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
    //     runTestsViaURL(request, token, controller);
    // });

    controller.createRunProfile('Run Coverage', vscode.TestRunProfileKind.Coverage, (request, token) => {
        return runHandler(request, token, controller, false, true);
    }, true, undefined, false);

    // controller.createRunProfile("Open Test URL",
    //     vscode.TestRunProfileKind.Debug,
    //     (request) => {
    //         for (const test of request.include ?? []) {
    //             const testMeta = testData.get(test);
    //             const url = testMeta.simpleURL;
    //             if (url) vscode.env.openExternal(vscode.Uri.parse(url));
    //         }
    //     }
    // );

    const watcher = vscode.workspace.createFileSystemWatcher(testFileGlob);

    watcher.onDidCreate(file => {
        console.log("File created", file);
        discoverTests(controller)
    });
    watcher.onDidChange(file => {
        discoverTests(controller, [file])
    });
    watcher.onDidDelete(file => {
        console.log("File deleted", file);
        discoverTests(controller)
    });


    const settingsWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("testbox")) {
            discoverTests(controller);
        }
    })

    // Populate the controller with on creation
    discoverTests(controller);

    return { controller, watcher, settingsWatcher };
}

 /**
  * Get the box.json runner, if not try the value from the configuration
  **/
 async function getTestBoxRunnerUrl(){
    // Look for the box file in the root. 
    const boxFiles = await vscode.workspace.findFiles("box.json", "", 1);
    if(boxFiles && boxFiles.length){
        const boxFileDoc = await vscode.workspace.openTextDocument(boxFiles[0]);
        const boxFileJSON = JSON.parse(boxFileDoc.getText());
        return boxFileJSON.testbox?.runner;
    }
    // If we dont have it check in the settings
    return vscode.workspace.getConfiguration("testbox").get("runnerUrl");
    
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
async function discoverTests(controller, selectedFiles) {
    // TODO: manage if we are changing a single item. This can cause the tree to blow up.
    // Clear out previous items
     controller.items.replace([]);
     console.log("TODO, clear out only selected items" , selectedFiles)
    // if(selectedFiles) { 
    //     for(const selectedFile of selectedFiles) {
    //         controller.items.forEach(item => {
                
    //             if(item.uri.path == selectedFile.path) {
                    
    //                 controller.items.delete(item);
    //             }
    //         });
    //     }
    // }
    // else {
    //     controller.items.replace([]);
    // }
    let runnerUrl = await getTestBoxRunnerUrl();
    // try and find the runnerURL if it is not defined.
    if(!runnerUrl){
        vscode.workspace.showErrorMessage("No Runner URL found in settings of boxfile");
        return;
        
    }

    let bundles = vscode.workspace.getConfiguration("testbox").get("bundles"); //??
    console.log("Bundles arent used", bundles);
    const excludedPaths = vscode.workspace.getConfiguration("testbox").get("excludedPaths");
    const excludedPackagesConfig = vscode.workspace.getConfiguration("testbox").get("excludedPackages", "") || "";
    const excludedPackagesArray = excludedPackagesConfig.split(",").map(pkg => pkg.trim()).filter(pkg => pkg !== "");

    // Files are at the top of the test tree, so a bundle == file == a top root item. WE can create sub children etc. but those are at the top 
    // const files = selectedFiles || await vscode.workspace.findFiles(testFileGlob, excludedPaths);
    const files = await vscode.workspace.findFiles(testFileGlob, excludedPaths);

    const resolveChildren = false;

    foundfiles: for (const file of files) {
        const absolutePath = applyPathMappings(vscode.workspace.asRelativePath(file.fsPath));
        const packageName = convertToDottedPackageName(absolutePath);
       
        // Check if the package is excluded
        for (const expackage of excludedPackagesArray) {
            if (packageName.startsWith(expackage)) {
                LOG.debug(`Skipping ${packageName} as it is in the excluded packages`);
                continue foundfiles;
            }
        }
        // ID == "bundle_" + packageName;
        
        // Create thee tree root. 
        const root = controller.createTestItem( "bundle_" + packageName, packageName, file);
        root.description = `Bundle`;
        root.tags = ["bundle"];
        root.canResolveChildren = false;
        root.range = new vscode.Range(0, 0, 0, 0);
        // The canResolveChildren is set to false so we can add the children manually. This means that we can add results to the children if they are not expanded. 
        root.canResolveChildren = resolveChildren;

        // This wouldnt be runtime. I am adding here to see about speeding up the process
        if(!root.canResolveChildren){
            const content = await vscode.workspace.openTextDocument(file);
            const tree = await generateTreeFromText(content.getText(), absolutePath, packageName, runnerUrl);
            createTestTree(tree, root, controller);
            testData.set(root, tree);
        }
        else {



            root.resolveHandler = async (item) => {
                // Only resolve if children are not already loaded
                if (item.children.size > 0) return;

                const tree = testData.get(item);
                if (!tree || !tree.children) return;

                createTestTree(tree, item, controller);
            };

        }
       

        // Lookups
        fileTestItems.set(file, root);
        controller.items.add(root);
        // createTestTree(tree, root, controller, 1, 1);
        // //Create  and parse the test Item

        

    
    }
}

function createTestTree(treeitem, viewRoot, controller) {

    // Get all the children of the tree
    if(!treeitem.children) { 
        return;
    }
    for(const item of treeitem.children) {
        if(item instanceof TreeSuite) {
            const subTest = controller.createTestItem(item.id, item.title, viewRoot.uri);
            subTest.description = "Suite";
            const range = item.range || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
            subTest.range = new vscode.Range(range.start.line , range.start.column, range.end.line, range.end.column);
            subTest.tags = ["suite"];
            viewRoot.children.add(subTest);
            testData.set(subTest, item);
            createTestTree(item, subTest, controller);
        }
        if(item instanceof TreeSpec) {
            const subTest = controller.createTestItem(item.id, item.title, viewRoot.uri);
            subTest.description = "Spec";
            const range = item.range || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
            subTest.range = new vscode.Range(range.start.line, range.start.column, range.end.line, range.end.column);
            subTest.tags = ["spec"];
            viewRoot.children.add(subTest);
            testData.set(subTest, item);
        }
    }

}



/**
 * Handles the test run request and cancellation.
 * @param {vscode.TestRunRequest} request - The test run request.
 * @param {vscode.CancellationToken} cancellation - The cancellation token.
 * 
 */
function runHandler(request, cancellation, controller, isDebug = false, isCoverage = false) {

    
    if (!request.continuous) {
        return startTestRunViaURL(request, controller, cancellation, isDebug, isCoverage);
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
async function startTestRunViaURL(request, controller, cancellation, isDebug = false, isCoverage = false) {

    const runnerUrl = await getTestBoxRunnerUrl();
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
    
    // Preload the coverage since I cant be bothered to wait for the results
    if(isCoverage) {
        const coverageResults = await getCoverageResults();
        // @see https://code.visualstudio.com/api/references/vscode-api#StatementCoverage
        // @see https://code.visualstudio.com/api/extension-guides/testing
        console.log("Going to get the coverage!", coverageResults);

        // test.addCoverage(coverageResults);
        // const coverage = new vscode.FileCoverage();

        run.addCoverage(coverageResults);
    }


    console.log("Going to run the following tests", testqueue);

    // const testRuns = (testqueue ?? {}).map(
    //     test => runIndividualTest(test, request, run)
    // );
const mapper = async (test) => {
        return await runIndividualTest(test, request, run, cancellation, isDebug, isCoverage);
    }
    await pMap(testqueue, mapper, {concurrency: threads});

   
    run.end();
  
}


async function getCoverageResults() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const coverageFolder = vscode.workspace.getConfiguration("testbox").get("coverageRelativePath", null);

    if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }
    if (!coverageFolder) {
        vscode.window.showErrorMessage("No Testbox Coverage Folder configured in settings.");
        return;
    }
    
    // Make the path absolute: 
    const coverageFolderPath = path.join(workspaceFolder.uri.fsPath, coverageFolder);
    // const luceeExectionReport = new LuceeExectionReport(coverageFolderPath);


    

    return {};
}

// DISPLAY TERMINAL STUFF
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
// const YELLOW = "\x1b[33m";
// const MAGENTA = "\x1b[35m";
// const CYAN = "\x1b[36m";
const BLUE = "\x1b[34m";

const RESET = "\x1b[0m";
const prefix = {
    "Passed": `${GREEN}√ `,
    "Failed": `${RED}X `,
    "Errored": `${RED}!! `,
    "Error": `${RED}!! `,
    "Skipped": `${BLUE}- `,
}
const nl = "\r\n";
const tab = " ";


// We will need to do some kind of tree of this
function renderResult(results, run) {
    run.appendOutput(nl);
    // run.appendOutput(`STARTING OUTPUT \r\n`);
    // This would output the "running tests please wait"
    const tableOut = drawTable(
        ["Passed", "Failed", "Errored", "Skipped", "Bundles", "Suites", "Specs"],
        [
            results.totalPass,
            results.totalFail,
            results.totalError,
            results.totalSkipped,
            results.totalBundles,
            results.totalSuites,
            results.totalSpecs,
            
        ]
    );
    let tableColor = GREEN;
    if(results.totalFail != 0 || results.totalError != 0) {
        tableColor = RED;
    }
    else if (results.totalSkipped != 0 && results.totalPass == 0) {
        tableColor = BLUE;
    }

    run.appendOutput(BOLD + tableColor + tableOut + nl + RESET);

    results.bundleStats = results.bundleStats || [];
    for(const bundle of results.bundleStats) {
        renderBundle(bundle, run);
    }
      
    // const tabs = tab.repeat(2);
    
    let labels = (results.labels || []).join(", ");
    if(labels.length == 0) {
        labels = "---";
    }
    
    run.appendOutput(`${BOLD}TestBox\t\t${results.version} ${nl}`);
    run.appendOutput(`${BOLD}CFML Engine\t${results.CFMLEngine} v {results.CFMLEngineVersion}${nl}`);
    run.appendOutput(`${BOLD}Duration\t\t${results.totalDuration}ms${nl}`);
    run.appendOutput(`${BOLD}Labels\t\t${labels}${nl}`);
    run.appendOutput(nl);
    // CFML Engine     Lucee v5.4.6.9
    // Duration        21ms
    // Labels          ---

    run.appendOutput(`${prefix.Passed}Passed${RESET}  ${prefix.Skipped}Skipped${RESET}  ${prefix.Error}Exception/Error${RESET}  ${prefix.Failed}Failure${RESET}`);// 
    run.appendOutput(nl);
    // run.appendOutput(`FINISHED OUTPUT \r\n`);
}

function renderBundle(bundle, run) {
    run.appendOutput(`${RESET}`);
     
    let totalPass = bundle.totalPass || 0;
    let totalFail = bundle.totalFail || 0;
    let totalError = bundle.totalError || 0;
    let totalSkipped = bundle.totalSkipped || 0;
    let totalDuration = bundle.totalDuration || 0;
    let titlePrefix = prefix.Passed;

    if(totalFail > 0) {
        titlePrefix = prefix.Failed;
    }
    else if(totalError > 0) {
        titlePrefix = prefix.Failed;
    }
  
    if (bundle.totalSuites == 0 && bundle.totalSpecs == 0){
        // There is nothing to report here. We did not run any tests
        return;
    }
    run.appendOutput(`${BOLD}${titlePrefix}${bundle.name} (${totalDuration} ms)${nl}`);
    run.appendOutput(`[Passed: ${totalPass}] [Failed: ${totalFail}] [Errors: ${totalError}] [Skipped: ${totalSkipped}] [Suites/Specs: ${bundle.totalSuites}/${bundle.totalSpecs}]${nl}`);
    run.appendOutput(`${RESET}`);
    run.appendOutput(nl);
    bundle.suiteStats = bundle.suiteStats || [];

    for(const suite of bundle.suiteStats) {
        renderBundleOrSuiteResult(suite, run, 1);
        run.appendOutput(nl + nl);
        
    }
    

}
function renderBundleOrSuiteResult(bunbdleOrSpec, run, tablevel = 0) {
     run.appendOutput(`${RESET}`);

    const titleprefix = prefix[bunbdleOrSpec.status || prefix.Passed];
    const totalDuration = bunbdleOrSpec.totalDuration || 0;  
    const tabs = tab.repeat(tablevel);
    // const tabs = "";


    run.appendOutput(`${tabs}${titleprefix}${bunbdleOrSpec.name} ( ${totalDuration} ms)${nl}`);

    if(bunbdleOrSpec.status == "Failed" && bunbdleOrSpec.hasOwnProperty("suiteID")) {
        run.appendOutput(`${tabs}${tab}${RED}-> Failure: ${bunbdleOrSpec.failMessage}${nl}`);
    }

    bunbdleOrSpec.suiteStats = bunbdleOrSpec.suiteStats || [];
    for(const suite of bunbdleOrSpec.suiteStats) {
        renderBundleOrSuiteResult(suite, run, tablevel+1);
    }

    bunbdleOrSpec.specStats = bunbdleOrSpec.specStats || [];
    for(const spec of bunbdleOrSpec.specStats) {
        renderBundleOrSuiteResult(spec, run, tablevel+1);
    }

}

async function runIndividualTest(test, request, run, cancellation, isDebug = false, isCoverage = false) {
    
    const testMeta = testData.get(test);
    let urlToRun = testMeta.url;
    if(isCoverage) {
        // TODO: this is incorrect, we need to make sure we put the right url variables. 
        urlToRun = urlToRun + "&=coverage=true";
    }

    if(isDebug) {
        // Have to somehow start luceedebuig?
    }

    

    const start = Date.now();
    run.started(test);
    
    if(cancellation.isCancellationRequested) {
        run.appendOutput(`\t🚨  Test cancelled [${test.id}]\r\n`)
        run.errored(test, `Test cancelled [${test.id}]`);
        return;
    }

    const message = `Executing tests ${urlToRun} \r\nPlease wait...\r\n`;
    run.appendOutput(`${BOLD}${GREEN}${message}${RESET}`);

    try {
        const response = await fetch(urlToRun);
        if (!response.ok) {
                const message = `\t🚨 HTTP error ${response.status} [${urlToRun}]\r\n`;
                run.errored(test, message, Date.now() - start);
                // run.end(test)
                vscode.window.showErrorMessage(message);
                run.appendOutput(message);
                // Nothing else to do for this test
                return;
        }

        // const testMeta = testData.get(test);

        const results = await response.json();
        const testResults = parseTestResults(results);
        const specResults = testResults.getSpecs(); //Gets all the specs that were run
        const testSpecs = getAllSpecsFromTest(test); //Gets all  tests in the tree
      
        // Todo: check if there are multiple specs with the same name. If so then we can do something more complicated

        let notFoundResults = specResults.filter(result => {
            const testMeta = testData.get(test);
            return result.name !== testMeta.title;
        });

        console.log("Not found results", notFoundResults);
        //Handle the results by trying to find the bundle and looking up and setting the results
        //if we didnt get any specResults, we should check if the root was skipped

        if(testResults.totalSkipped == testResults.totalSpecs) {
            run.skipped(test, `All tests skipped [${test.id}]`);
        }



        for(const result of specResults) {
            for (const test of testSpecs) {
                const meta = testData.get(test);
                if (result.name === meta.title) {
                    updateTestWithResults(test, result, run);
                    break;
                }
                else {
                    // Test not found... we could try going down the tree and find/add it?
                }
            }
        }
        // Format all the results
        
        // run.passed(test, Date.now() - start);
        renderResult(results, run);

        



        // run.end();
    }
    catch (error) {
        run.appendOutput(`🧪: ${testMeta.getTestLabelPath()}\r\n`);

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
    TestBundle,
    TestSuite,
    TestSpec,
    renderResult
};