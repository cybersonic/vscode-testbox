// I generate a tree structure for testing 
const { getTestsFromText } = require("./cftokensParser");

const validSuites = "describe,given,when,feature,scenario,story".split(",");
const validSpecs = ["it", "xit", "then"];

class TreeBundle {
    path = "";
    directory = "";
    runnerUrl = "";
    packageName = "";
    children = [];
    childrenLoaded= false;

    constructor(filePath, packageName, runnerUrl, root) {
        this.path = filePath;
        this.directory = packageName.split('.').slice(0, -1).join('.');;
        this.packageName = packageName;
        this.runnerUrl = runnerUrl;
        this.children = [];
        this.id = "bundle_" + packageName;
        this.url = this.getJSONReporterURL();
        this.bundle = this;
        this.range = { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } }

        if(root){
            this.childrenLoaded = true;
        }
        for (var item of root) {


            if (validSpecs.includes(item.type)) {
                this.children.push(
                    new TreeSpec(item, this, this)
                )
            }
            else if (validSuites.includes(item.type)) {
                this.children.push(
                    new TreeSuite(item, this, this)
                )
            }

            // we normally would have testsuites here, but there could be some testspecs
            // this.children.push(
            //     new TreeSuite(item, this, this)
            // )
        }

    }

     getJSONReporterURL() {

        const querystring = {
            method: "runRemote",
            reporter: "JSON",
            recurse: false,
            directory: encodeURIComponent(this.directory),
            testBundles: encodeURIComponent(this.packageName),
            opt_run: true,
            coverageEnabled: false
        };
        const qs = new URLSearchParams(querystring).toString();

        return `${this.runnerUrl}?${qs}`;
    }
    getSimpleReporterURL() {
        // const runnerUrl = vscode.workspace.getConfiguration("testbox").get("runnerUrl");
        // if (!runnerUrl) {
        //     vscode.window.showErrorMessage("No Testbox Runner URL configured in settings.");
        //     return;
        // }
        // const bundleName = this.name;
        // const dirName = this.directory;
        // return `${runnerUrl}?reporter=simple&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
    }

    async getText() {
        // const doc = await vscode.workspace.openTextDocument(this.path);
        // return doc.getText();
    }

    //     const testURLSimple = `${runnerUrl}?reporter=simple&recurse=false&directory=${dirName}&testBundles=${encodeURIComponent(bundleName)}`;
    //     // These are the root items. in theory all would be Specs?
    //     const testItem = controller.createTestItem(testUrl, bundleName, file);
    getTestLabelPath() {
        return this.directory;
    }
}

class TreeSuite {
    // id = "";
    name = "";
    title = "";
    // fullLine = "";
    startOffset = 0;
    endOffset = "";
    range = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    // bundle = "";
    // parent = "";
    // skipped = false;
    children = [];

    constructor(block, bundle, parent) {


        this.name = block.type;
        // this.fullLine = block.fullLine;
        this.title = block.title;
        this.startOffset = block.offset;
        this.endOffset = block.endOffset;
        this.range = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
        
        if(block.range.start){
            this.range.start.line = block.range.start.line;
            this.range.start.column = block.range.start.column;
        }

        if(block.range.end){
            this.range.end.line = block.range.end.line;
            this.range.end.column = block.range.end.column;
        }
        else {
            this.range.end.line = block.range.start.line;
            this.range.end.column = block.range.start.column;   
        }
        
        this.skipped = block.skipped || false; //TODO: check for skipped in the arguments
        this.bundle = bundle;
        this.parent = parent;
        this.id = parent.id + "_suite_" + this.title;
        this.url = this.getJSONReporterURL();

        for (var blockItem of block.children) {
            if (validSpecs.includes(blockItem.type)) {
                this.children.push(new TreeSpec(blockItem, bundle, this));
            }
            else if (validSuites.includes(blockItem.type)) {
                this.children.push(new TreeSuite(blockItem, bundle, this));
            }



        }
    }


    getID() {
        return this.bundle.name + "suite" + this.title;
    }
    getJSONReporterURL() {

        const querystring = {
            method: "runRemote",
            reporter: "JSON",
            recurse: false,
            directory: encodeURIComponent(this.bundle.directory),
            testBundles: encodeURIComponent(this.bundle.packageName),
            testSuites: encodeURIComponent(this.title),
            opt_run: true,
            coverageEnabled: false
        };
        const qs = new URLSearchParams(querystring).toString();

        return `${this.bundle.runnerUrl}?${qs}`;
    }
    getURI() {
        return this.bundle.path;
    }
    getTestLabelPath() {
        return this.title;
    }
}

class TreeSpec {
    id = "";
    title = "";
    name = "";
    startOffset = "";
    endOffset = "";
    range = "";
    children = "";
    parent = "";
    bundle = "";
    constructor(block, bundle, parent) {
        this.name = block.type;

        this.title = block.title;
        this.startOffset = block.startOffset;
        this.endOffset = block.endOffset;
        this.range = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
        
        if(block.range.start){
            this.range.start.line = block.range.start.line;
            this.range.start.column = block.range.start.column;
        }

        if(block.range.end){
            this.range.end.line = block.range.end.line;
            this.range.end.column = block.range.end.column;
        }
        else {
            this.range.end.line = block.range.start.line;
            this.range.end.column = block.range.start.column;   
        }
        this.skipped = block.skipped || false;
        this.children = block.children || [];
        this.parent = parent;
        this.bundle = bundle;
        this.id = parent.id + "_spec_" + this.title;
        this.url = this.getJSONReporterURL();
    }

    getID() {
        return this.parent.getID() + "spec" + this.title;
    }
    getJSONReporterURL() {

        const querystring = {
            method: "runRemote",
            reporter: "JSON",
            recurse: false,
            directory: encodeURIComponent(this.bundle.directory),
            testBundles: encodeURIComponent(this.bundle.packageName),
            testSpec: encodeURIComponent(this.title),
            // testSuite: encodeURIComponent(this.parent.title), //Dont provide suite. Just say the budnle 
            opt_run: true,
            coverageEnabled: false
        };
        const qs = new URLSearchParams(querystring).toString();

        return `${this.bundle.runnerUrl}?${qs}`;
    }
    getURI() {
        return this.bundle.path;
    }
    getTestLabelPath() {
        return this.title;
    }
}



async function generateTreeFromText(text, filePath, packageName, baseURL) {

    const tree = await getTestsFromText(text);
    const treeRoot = new TreeBundle(filePath, packageName, baseURL, tree);

    return treeRoot;
}

module.exports = {generateTreeFromText, TreeBundle, TreeSuite, TreeSpec };