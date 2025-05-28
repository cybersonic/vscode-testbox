const vscode = require("vscode");
// const { parseTestBlocks } = require('../utils/bddParser');
// const { getTestsFromText } = require('../utils/cftokensParser');
const { generateTreeFromText, TreeSuite, TreeSpec } = require('../utils/testTreeGenerator');
const { parseTestResults, getAllSpecsFromTest, updateTestWithResults } = require("../utils/resultParser");
const { LOG } = require("../utils/logger");
const pLimit = require("p-limit").default; // Not sure this will work
const {renderResult} = require("../utils/resultRenderer");
// const { parseLuceeExecLog, LuceeExectionReport } = require("../utils/luceeExecLogParser");

const testFileGlob = '**/*{Spec,Test,Tests}.cfc'; //<-- should be configurable

/**
 * See https://code.visualstudio.com/api/extension-guides/testing
 */

// Lookup Maps: Used to store extra data about the tests and map to files
const testData = new WeakMap();

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

        for (var blockitem of block) {
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
    getTestLabelPath() {
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

        for (var blockitem of block.children) {
            if (["it", "xit"].includes(blockitem.name)) {
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
    getURI() {
        return this.bundle.path;
    }
    getTestLabelPath() {
        return this.bundle.getTestLabelPath() + ": " + this.title;
    }
}
class TestSpec {
    id = "";
    title = "";
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
    getURI() {
        return this.bundle.path;
    }
    getTestLabelPath() {
        return this.bundle.getTestLabelPath() + ":" + this.title + "\r\n\t" + this.getJSONReporterURL();
    }
}

// This creates the explorer view. A lot of the functions are added within as they need the controller which we keep in the createTestExplorerView scope
function createTestExplorerView() {
    const controller = vscode.tests.createTestController('cfmlTestController', 'CFML Tests');

    controller.resolveHandler = async test => {
        // So we could do some kind of lazy loading here. 
        if (!test) {
            await discoverAllFilesInWorkspace();
        // Add performance markers
        console.time('discoverAllFilesInWorkspace');
        await discoverAllFilesInWorkspace();
        console.timeEnd('discoverAllFilesInWorkspace');

        // For the selection area:
            } else {
                console.time(`parseTestsInFileContents-${test.id}`);
                await parseTestsInFileContents(test);
                console.timeEnd(`parseTestsInFileContents-${test.id}`);
            }
            };

            // Throttle document change events to avoid excessive parsing
            let parseTimeout;
            const throttledParseDocument = (document) => {
            clearTimeout(parseTimeout);
            parseTimeout = setTimeout(() => parseTestsInDocument(document), 300);
            };

            vscode.workspace.onDidChangeTextDocument(async e => await throttledParseDocument(e.document));

            vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("testbox")) {
                console.time('configChange-discoverAllFilesInWorkspace');
                discoverAllFilesInWorkspace();
                console.timeEnd('configChange-discoverAllFilesInWorkspace');
            }
            });

            async function getOrCreateFile(uri) {
            const existing = controller.items.get(uri.toString());
            if (existing) {
                return existing;
        }

        // Exclude examples:
        // "testbox.excludedPaths": "{sites,slaps,devops,tests/testbox}/**",
        // "testbox.excludedPackages": "tests.testbox,tests.testcases.BaseDistroKidTest",
        // const excludedPathsConfig = vscode.workspace.getConfiguration("testbox").get("excludedPaths", "") || "**/**";
        const excludedPackagesConfig = vscode.workspace.getConfiguration("testbox").get("excludedPackages", "") || "";

        const excludedPackagesArray = excludedPackagesConfig.split(",").map(pkg => pkg.trim().toLowerCase()).filter(pkg => pkg !== "");

        const relativePath = vscode.workspace.asRelativePath(uri)

        const mappedPath = applyPathMappings(relativePath);
        const packageName = convertToDottedPackageName(mappedPath);
        // Should be done in a separate function
        for (const excludedPackage of excludedPackagesArray) {
            // Set to lowercase to make sure we are not case senssitive
            if (packageName.toLowerCase().startsWith(excludedPackage)) {
                return;
            }
        }

        const testItem = controller.createTestItem(packageName, packageName, uri);
        testItem.description = `Bundle`;
        // testItem.tags = ["bundle"];
        testItem.canResolveChildren = true;
        const runnerUrl = await getTestBoxRunnerUrl();
        const testBundle = new TestBundle(mappedPath, packageName, runnerUrl, [])
        testData.set(testItem, testBundle);
        controller.items.add(testItem);
        return testItem;

    }

    async function parseTestsInDocument(document) {
        if (document.uri.scheme === "file" && document.languageId === "cfml") {
            parseTestsInFileContents(await getOrCreateFile(document.uri), document.getText());
        }
    }


   

    // file: vscode.TestItem, contents?: string
    async function parseTestsInFileContents(testItem, contents) {
        // If document is already open, if we are in a resolve handler it might not be open yet and we need to read it from disk
        if (contents === undefined) {
            const rawContent = await vscode.workspace.fs.readFile(testItem.uri);
            contents = new TextDecoder().decode(rawContent);
        }
        const runnerUrl = await getTestBoxRunnerUrl();
        const tree = await generateTreeFromText(contents, testItem.uri, testItem.id, runnerUrl);
        createTestTree(tree, testItem, controller);
        testData.set(testItem, tree);
    }

    async function discoverAllFilesInWorkspace() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            // if there are no workspace folders, we cannot discover any files
            return [];
        }
        controller.items.replace([]); // Clear out the previous items
        return Promise.all(
            vscode.workspace.workspaceFolders.map(async (workspaceFolder) => {
                const pattern = new vscode.RelativePattern(workspaceFolder, testFileGlob);
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);

                // When a file is created,add it to the tree.
                watcher.onDidCreate(uri => getOrCreateFile(uri));

                // When we change it, re-parse the file contents
                watcher.onDidChange(uri => parseTestsInFileContents(getOrCreateFile(uri)));

                // When we delete it, remove it from the tree
                watcher.onDidDelete(uri => controller.items.delete(uri.toString()));
                
                
                console.time('vscode.workspace.findFiles');
                const files = await vscode.workspace.findFiles(pattern, "", 1000);
                for (const file of files) {
                    getOrCreateFile(file);
                }
                console.timeEnd('vscode.workspace.findFiles');
            }) //end  vscode.workspace.workspaceFolders.map(async (folder)
        );
    }


    // Run the Tests
    controller.createRunProfile(
        "Run",
        vscode.TestRunProfileKind.Run,
        (request, token) => {
            return runHandler(false, false, request, token);
        },
    );

    
    

    // const debugProfile = controller.createRunProfile(
    //     "Debug",
    //     vscode.TestRunProfileKind.Debug,
    //     (request, token) => {
    //         return runHandler(false, true, request, token);
    //     },
    // );

    // const coverageProfile = controller.createRunProfile(
    //     "Run",
    //     vscode.TestRunProfileKind.Coverage,
    //     (request, token) => {
    //         return runHandler(true, false, request, token);
    //     },
    // );


    /**
     * Handles the execution or debugging of a test run.
     *
     * @param {boolean} [shouldDebug=false] - Indicates whether to run in debug mode.
     * @param {vscode.TestRunRequest} request - The request object containing test run information.
     * @param {vscode.CancellationToken} token - A cancellation token or identifier for the run.
     */
    async function runHandler(shouldCoverage = false, shouldDebug = false, request, token) {
        const run = controller.createTestRun(request);
        const queue = [];

        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            controller.items.forEach(test => queue.push(test));
        }
        const dedupeQueue = filterSelection(queue);

        const threads = getTotalRunnerThreads();
        const limit = pLimit(threads);

        // Prepare an array of limited test runners
        const testPromises = dedupeQueue.map(test => 
            limit(async () => {
                if (token.isCancellationRequested) return;
                // Skip tests the user asked to exclude
                if (request.exclude?.includes(test)) return;

                // If we don't know the children in a bundle, parse them now.
                if (test.children.size === 0) {
                    await parseTestsInFileContents(test);
                }

                const testMeta = testData.get(test);
                console.log({ testMeta });
                if (testMeta instanceof TestBundle) {
                    // We can use the topline results.
                }
                await runIndividualTest(test, request, run, token, shouldCoverage, shouldDebug);
            })
        );

        // Wait for all tests to finish or cancellation
        await Promise.all(testPromises);

        run.end();
    }


    // helperfunctions
    function hasSelectedAncestor(item, selectedSet) {
        let current = item.parent;
        while (current) {
            if (selectedSet.has(current.id)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    function filterSelection(selectedItems) {
        const selectedSet = new Set(selectedItems.map(item => item.id));

        return selectedItems.filter(item => !hasSelectedAncestor(item, selectedSet));
    }

    
    async function runIndividualTest(test, request, run, cancellation, isDebug = false, isCoverage = false) {

        run.appendOutput(`Running test ${test.id}`);
        const start = Date.now();
        run.started(test);
        const testMeta = testData.get(test);
        let urlToRun = testMeta.getJSONReporterURL();
        // Not implemented
        if (isCoverage) {  // urlToRun = urlToRun + "&=coverage=true"; 
        }
        if (isDebug) { // Have to somehow start luceedebuig?
        }

        if (cancellation.isCancellationRequested) {
            run.appendOutput(`\t🚨  Test cancelled [${test.id}]\r\n`)
            run.errored(test, `Test cancelled [${test.id}]`);
            return;
        }
        // const runnerType = vscode.workspace.getConfiguration("testbox").get("runnerType", "json");
        try {
            run.appendOutput(`🧪: ${test.label} [${urlToRun}]\r\n`);
            const response = await fetch(urlToRun);
            if (!response.ok) {
                const message = `\t🚨 HTTP error ${response.status} [${urlToRun}]\r\n`;
                run.errored(test, message, Date.now() - start);
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

            // let notFoundResults = specResults.filter(result => {
            //     const testMeta = testData.get(test);
            //     return result.name !== testMeta.title;
            // });

            // console.log("Not found results", notFoundResults);
            //Handle the results by trying to find the bundle and looking up and setting the results
            //if we didnt get any specResults, we should check if the root was skipped

            if (testResults.totalSkipped == testResults.totalSpecs) {
                run.skipped(test, `All tests skipped [${test.id}]`);
            }



            for (const result of specResults) {
                for (const test of testSpecs) {
                    const meta = testData.get(test);
                    if (result.name === meta.title) {
                        updateTestWithResults(test, result, run);
                        break;
                    }
                    
                }
            }
            // Format all the results

            // run.passed(test, Date.now() - start);
            // TODO:
            renderResult(results, run);

            // const statement = new vscode.StatementCoverage(true, new vscode.Range(0, 50, 10, 1));

            // const fileCoverage = new vscode.FileCoverage(test.uri, [statement]);

            // // new vscode.CoverageResult(test.label, test.uri, [fileCoverage], Date.now() - start);
            // run.addCoverage(fileCoverage)


            // run.end();
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

    }
    // 

    // Create a run profile that runs tests
    // controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
    //     return runHandler(request, token, controller);
    // }, true, undefined, false);
    // controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
    //     runTestsViaURL(request, token, controller);
    // });

    // controller.createRunProfile('Run Coverage', vscode.TestRunProfileKind.Coverage, (request, token) => {
    //     return runHandler(request, token, controller, false, true);
    // }, true, undefined, false);

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

    // const watcher = vscode.workspace.createFileSystemWatcher(testFileGlob);

    // watcher.onDidCreate(file => {
    //     console.log("File created", file);
    //     discoverTests(controller)
    // });
    // watcher.onDidChange(file => {
    //     discoverTests(controller, [file])
    // });
    // watcher.onDidDelete(file => {
    //     console.log("File deleted", file);
    //     discoverTests(controller)
    // });


    // const settingsWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    //     if (e.affectsConfiguration("testbox")) {
    //         discoverTests(controller);
    //     }
    // })

    // Populate the controller with on creation
    // discoverTests(controller);

    return { controller /* , watcher, settingsWatcher */ };
}







/**
 * Get the box.json runner, if not try the value from the configuration
 **/
async function getTestBoxRunnerUrl() {
    // Look for the box file in the root. 
    const boxFiles = await vscode.workspace.findFiles("box.json", "", 1);
    if (boxFiles && boxFiles.length) {
        // Dont have to actually open the file to emit it 
        const boxFileDoc = await vscode.workspace.fs.readFile(boxFiles[0]);
        const boxFileJSON = JSON.parse(boxFileDoc);
        if(boxFileJSON.testbox && boxFileJSON.testbox.runner) {
            return boxFileJSON.testbox?.runner;
        }
    }
    // If we dont have it check in the settings
    return await vscode.workspace.getConfiguration("testbox").get("runnerUrl");

}

function createTestTree(treeitem, viewRoot, controller) {

    // Get all the children of the tree
    if (!treeitem.children) {
        return;
    }
    for (const item of treeitem.children) {
        if (item instanceof TreeSuite) {
            const subTest = controller.createTestItem(item.id, item.title, viewRoot.uri);
            subTest.description = "Suite";
            const range = item.range || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
            subTest.range = new vscode.Range(range.start.line, range.start.column, range.end.line, range.end.column);
            subTest.tags = ["suite"];
            viewRoot.children.add(subTest);
            testData.set(subTest, item);
            createTestTree(item, subTest, controller);
        }
        if (item instanceof TreeSpec) {
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
// async function discoverTests(controller, selectedFiles) {
//     return;
//     // TODO: manage if we are changing a single item. This can cause the tree to blow up.
//     // Clear out previous items
//     controller.items.replace([]);
//     console.log("TODO, clear out only selected items", selectedFiles)
//     // if(selectedFiles) { 
//     //     for(const selectedFile of selectedFiles) {
//     //         controller.items.forEach(item => {

//     //             if(item.uri.path == selectedFile.path) {

//     //                 controller.items.delete(item);
//     //             }
//     //         });
//     //     }
//     // }
//     // else {
//     //     controller.items.replace([]);
//     // }
//     let runnerUrl = await getTestBoxRunnerUrl();
//     // try and find the runnerURL if it is not defined.
//     if (!runnerUrl) {
//         vscode.workspace.showErrorMessage("No Runner URL found in settings of boxfile");
//         return;

//     }

//     let bundles = vscode.workspace.getConfiguration("testbox").get("bundles"); //??
//     console.log("Bundles arent used", bundles);
//     const excludedPaths = vscode.workspace.getConfiguration("testbox").get("excludedPaths");
//     const excludedPackagesConfig = vscode.workspace.getConfiguration("testbox").get("excludedPackages", "") || "";
//     const excludedPackagesArray = excludedPackagesConfig.split(",").map(pkg => pkg.trim()).filter(pkg => pkg !== "");

//     // Files are at the top of the test tree, so a bundle == file == a top root item. WE can create sub children etc. but those are at the top 
//     // const files = selectedFiles || await vscode.workspace.findFiles(testFileGlob, excludedPaths);
//     const files = await vscode.workspace.findFiles(testFileGlob, excludedPaths);

//     const resolveChildren = false;

//     foundfiles: for (const file of files) {
//         const absolutePath = applyPathMappings(vscode.workspace.asRelativePath(file.fsPath));
//         const packageName = convertToDottedPackageName(absolutePath);

//         // Check if the package is excluded
//         for (const expackage of excludedPackagesArray) {
//             if (packageName.startsWith(expackage)) {
//                 LOG.debug(`Skipping ${packageName} as it is in the excluded packages`);
//                 continue foundfiles;
//             }
//         }
//         // ID == "bundle_" + packageName;

//         // Create thee tree root. 
//         const root = controller.createTestItem("bundle_" + packageName, packageName, file);
//         root.description = `Bundle`;
//         root.tags = ["bundle"];
//         root.canResolveChildren = false;
//         root.range = new vscode.Range(0, 0, 0, 0);
//         // The canResolveChildren is set to false so we can add the children manually. This means that we can add results to the children if they are not expanded. 
//         root.canResolveChildren = resolveChildren;

//         // This wouldnt be runtime. I am adding here to see about speeding up the process
//         if (!root.canResolveChildren) {
//             const content = await vscode.workspace.openTextDocument(file);
//             const tree = await generateTreeFromText(content.getText(), absolutePath, packageName, runnerUrl);
//             createTestTree(tree, root, controller);
//             testData.set(root, tree);
//         }
//         else {



//             root.resolveHandler = async (item) => {
//                 // Only resolve if children are not already loaded
//                 if (item.children.size > 0) return;

//                 const tree = testData.get(item);
//                 if (!tree || !tree.children) return;

//                 createTestTree(tree, item, controller);
//             };

//         }


//         // Lookups
//         fileTestItems.set(file, root);
//         controller.items.add(root);
//         // createTestTree(tree, root, controller, 1, 1);
//         // //Create  and parse the test Item




//     }
// }





/**
 * Handles the test run request and cancellation.
 * @param {vscode.TestRunRequest} request - The test run request.
 * @param {vscode.CancellationToken} cancellation - The cancellation token.
 * 
 */
// function runHandler(request, cancellation, controller, isDebug = false, isCoverage = false) {


//     if (!request.continuous) {
//         return startTestRunViaURL(request, controller, cancellation, isDebug, isCoverage);
//     }
//     else {
//         console.error("Continuous run not implemented");
//         // if (request.include === undefined) {
//         // 	watchingTests.set('ALL', request.profile);
//         // 	cancellation.onCancellationRequested(() => watchingTests.delete('ALL'));
//         // } else {
//         // 	request.include.forEach(item => watchingTests.set(item, request.profile));
//         // 	cancellation.onCancellationRequested(() => request.include!.forEach(item => watchingTests.delete(item)));
//         // }

//     }
// }


function getTotalRunnerThreads() {
    let threads = vscode.workspace.getConfiguration("testbox").get("urlThreads", 10);
    if (!threads || threads === 0) {
        threads = 10;
    }
    if (threads < 1) {
        threads = 1;
    }
    return threads;
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
    createTestExplorerView,
    TestBundle,
    TestSuite,
    TestSpec
};