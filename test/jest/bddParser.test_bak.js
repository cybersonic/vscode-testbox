const { extractTitleFromLine, parseTestBlocks, extractRunFunctionBody, getElementsFromParsed} = require('../../src/utils/bddParser.js');
const { iconResults, resultOutput, TestBundle, TestSuite } = require('../../src/views/testingExplorer');
const fs = require("fs");
const path = require('path');

test('Extracts title from double-quoted string', () => {
    const line = 'it("Some Title", function () {';
    const title = extractTitleFromLine(line);
    // assert.equal(title, "Some Title");
    expect(title).toBe("Some Title");
});

test('Extracts title from single-quoted string', () => {
    const line = "it('Another Title', function () {";
    const title = extractTitleFromLine(line);
    // assert.equal(title, "Another Title");
    expect(title).toBe("Another Title");
});

test('Extracts title from title attribute with double quotes', () => {
    const line = 'it(title="Attribute Title", function () {';
    const title = extractTitleFromLine(line);
    expect(title).toBe("Attribute Title");
});

test('Extracts title from title attribute with single quotes', () => {
    const line = "it(title='Attribute Title', function () {";
    const title = extractTitleFromLine(line);

    expect(title).toBe("Attribute Title");
});
test('Extracts title with commas and other things', () => {
    const line = "it( title:'getEarnings for user 123456 and date Dec-2018 to be 12,345.67', data:{\"id\":123456, \"dDate\":createDate(2018, 12, 31)}, body:function(data ) {	";
    const title = extractTitleFromLine(line);
    expect(title).toBe("getEarnings for user 123456 and date Dec-2018 to be 12,345.67");
});

test('Returns empty string if no title is found', () => {
    const line = 'it(function () {';
    const title = extractTitleFromLine(line);

    expect(title).toBe("");
});

test('Handles whitespace around title', () => {
    const line = 'it(   "  Spaced Title  "   , function () {';
    const title = extractTitleFromLine(line);
    expect(title).toBe("Spaced Title");

});

test('Handles missing parentheses gracefully', () => {
    const line = 'it "Missing Parentheses"';
    const title = extractTitleFromLine(line);
    expect(title).toBe("");

});

test('ignores tests within a comment block', () => {
    const test = `
        component extends="testbox.system.BaseSpec"{
	        function run( testResults , testBox ) {
            /*	describe("Comented out suite", function() {

	        		it( title:"commented out test", function() {});
                });
            */
		}`;


    const blocks = parseTestBlocks(test);
    expect(blocks.length).toBe(0);
});


test(' it within xdescribe should be ignored', () => {
    const test = `
        component extends="testbox.system.BaseSpec"{
	        function run( testResults , testBox ) {
            xdescribe("Comented out suite", function() {

	        	it( title:"not commented out test", function() {});
            });
        
		}`;
    const blocks = parseTestBlocks(test);

    expect(blocks.length).toBe(1);
    expect(blocks[0].skipped).toBe(true);

});

// test('fixes odd titling', () => {
//     const test = `it( title='getEarnings for user 123456 and date Dec2018 to be 12,345.68', data:{"id":123456, "dDate":createDate(2018, 12, 31)}, body:function(data ) {	
// 				local.stEarnings = db_getEarnings(data.id, data.dDate, 1);
// 				expect( decimalFormat(stEarnings.totalEarnings)).toBe("12,345.68");
// 			});	`;
//     const title = extractTitleFromLine(test);
//     expect(title).toBe("getEarnings for user 123456 and date Dec2018 to be 12,345.68");


// });

describe('tree metadata', () => {


    const relativePath = "test/app/tests/specs/unit/CalculatorTest.cfc";
    const absolutePath = path.resolve(relativePath);
    console.log(absolutePath);

    it('should parse a nested tree with a mix of suites and tests', () => { 
        const relativePath = "test/app/tests/specs/unit/CalculatorTest.cfc";
        const absolutePath = path.resolve(relativePath);
        const contents = fs.readFileSync(absolutePath, 'utf8');
        
       
        const bddTree = parseTestBlocks(contents);
       
        console.log(bddTree);
        expect(bddTree.length).toBe(2); 
        expect(bddTree[0].title).toBe("My First Suite");
        expect(bddTree[1].title).toBe("My Second Suite");

    });
});

describe('cftokens test parsing', () => {   

    const relativePath = "test/jest/CalculatorTest_parsed.json";
    const absolutePath = path.resolve(relativePath);
    const parsedCFMLJSON = fs.readFileSync(absolutePath, 'utf8');
    const parsedCFML = JSON.parse(parsedCFMLJSON);
    console.log(parsedCFML);

    const bddTree = getElementsFromParsed(parsedCFML);

    it('should return the correct number of test blocks', () => {
        expect(bddTree.length).toBe(2); // Adjust this based on your expected number of test blocks
    });

});