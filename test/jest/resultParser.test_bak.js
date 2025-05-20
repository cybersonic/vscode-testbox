const {describe} = require('jest');
const {parseTestResults} = require('../../src/utils/resultParser.js');
const fs = require('fs');

const resultJSON = fs.readFileSync("./test/jest/test_no_specs.json");
const results = JSON.parse(resultJSON);
const testResults = parseTestResults(results);

test('Parse test results', () => {
  
    // console.log(parsedResults);
    expect(testResults).toBeDefined();
    expect(testResults).toHaveProperty("totalSuites");
    expect(testResults).toHaveProperty("startTime");
    expect(testResults).toHaveProperty("totalPass");
    expect(testResults).toHaveProperty("totalDuration");
    expect(testResults).toHaveProperty("totalSkipped");
    expect(testResults).toHaveProperty("totalFail");
    expect(testResults).toHaveProperty("totalSpecs");
    expect(testResults).toHaveProperty("resultID");
    expect(testResults).toHaveProperty("endTime");
    expect(testResults).toHaveProperty("totalError");
    expect(testResults).toHaveProperty("totalBundles");
    expect(testResults).toHaveProperty("bundles");

    for(let bundle of testResults.bundles) {
      
        expect(bundle).toHaveProperty("totalSuites");
        expect(bundle).toHaveProperty("startTime");
        expect(bundle).toHaveProperty("totalPass");
        expect(bundle).toHaveProperty("totalDuration");
        expect(bundle).toHaveProperty("totalSkipped");
        expect(bundle).toHaveProperty("totalFail");
        expect(bundle).toHaveProperty("totalSpecs");
        expect(bundle).toHaveProperty("endTime");
        expect(bundle).toHaveProperty("totalError");
        expect(bundle).toHaveProperty("name");
        expect(bundle).toHaveProperty("id");

        for(let suite of bundle.suites) {
            // console.log(suite)
            expect(suite).toHaveProperty("totalSpecs");
            expect(suite).toHaveProperty("startTime");
            expect(suite).toHaveProperty("totalPass");
            expect(suite).toHaveProperty("totalDuration");
            expect(suite).toHaveProperty("totalSkipped");
            expect(suite).toHaveProperty("totalFail");
            expect(suite).toHaveProperty("name");
            expect(suite).toHaveProperty("id");
            expect(suite).toHaveProperty("suites");
            expect(suite).toHaveProperty("specs");

            for(let spec of suite.specs) {
               expect(spec).toHaveProperty("error");
               expect(spec).toHaveProperty("startTime");
               expect(spec).toHaveProperty("failExtendedInfo");
               expect(spec).toHaveProperty("totalDuration");
               expect(spec).toHaveProperty("failStacktrace");
               expect(spec).toHaveProperty("failOrigin");
               expect(spec).toHaveProperty("status");
               expect(spec).toHaveProperty("suiteID");
               expect(spec).toHaveProperty("endTime");
               expect(spec).toHaveProperty("name");
               expect(spec).toHaveProperty("id");
               expect(spec).toHaveProperty("failMessage");
               expect(spec).toHaveProperty("failDetail");
            }
        }
    }
   
});
test("Get all the specs, even in children", () => { 

    const specs = testResults.getSpecs();
    expect(specs).toBeDefined();
    // expect(specs.length).toBeGreaterThan(0);
    // console.log(specs);

});