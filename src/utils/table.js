const DOUBLE_LINE = {
  topLeft: '╔',          // U+2554
  topRight: '╗',         // U+2557
  bottomLeft: '╚',       // U+255A
  bottomRight: '╝',      // U+255D
  horizontal: '═',       // U+2550
  vertical: '║',         // U+2551
  topT: '╦',             // U+2566
  leftT: '╠',            // U+2560
  rightT: '╣',           // U+2563
  bottomT: '╩',          // U+2569
  center: '╬',           // U+256C
  topIntersection: '╤',  // U+2564 (optional alt for top header joins)
  bottomIntersection: '╧', // U+2567 (optional alt for bottom joins)
  leftIntersection: '╟', // U+255F (optional alt for left mid joins)
  rightIntersection: '╢', // U+2562 (optional alt for right mid joins)
};


function drawTable(header=[], data=[], newline="\r\n", maxWidth=10) {


        const columns = header.length;
        const bar = DOUBLE_LINE.horizontal.repeat(maxWidth);
        // const vert = DOUBLE_LINE.vertical;
        const linearr = new Array(columns).fill(bar);

        const top_horiz = linearr.join(DOUBLE_LINE.topT);
        const bottom_horiz = linearr.join(DOUBLE_LINE.bottomT); 
        const mid_horiz = linearr.join(DOUBLE_LINE.center);

        const top_line = [
            DOUBLE_LINE.topLeft,
           top_horiz,
            DOUBLE_LINE.topRight
        ].join("");
        const bottom_line = [
            DOUBLE_LINE.bottomLeft,
            bottom_horiz,
            DOUBLE_LINE.bottomRight
        ].join("");
        const mid_line = [
            DOUBLE_LINE.leftT,
            mid_horiz,
            DOUBLE_LINE.rightT
        ].join("");


        const headerRow = header.map(item => (" " + item).padEnd(10)).join(DOUBLE_LINE.vertical);
        // const rowlines = DOUBLE_LINE.horizontal.repeat(headerRow.length);

        
        const dataRow = data.map(item => (" " + item).padEnd(10)).join(DOUBLE_LINE.vertical);
        const table = [
            top_line,
            DOUBLE_LINE.vertical + headerRow + DOUBLE_LINE.vertical,
            mid_line,
            DOUBLE_LINE.vertical + dataRow +  DOUBLE_LINE.vertical,
            bottom_line
        ]



        const tableOut = table.join(newline);
        return tableOut;

}

module.exports = {
    drawTable

};