// textractService.js
const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");
const sharp = require('sharp');

console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY);

const client = new TextractClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function analyzeDocument(file, index) {
    console.log(`Starting analysis for file ${index}: ${file.originalname}`);
    if (!file || !file.buffer) {
        console.error(`Invalid file object for file ${index}`);
        throw new Error('Invalid file object');
    }

    console.log(`Analyzing file: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`);

    try {
        const resizedImage = await sharp(file.buffer)
            .resize(1500, 1500, { fit: 'inside' })
            .toBuffer();
        console.log(`Image resized successfully for file ${index}`);

        const params = {
            Document: {
                Bytes: resizedImage
            },
            FeatureTypes: ['TABLES', 'FORMS']
        };

        console.log(`Sending request to Textract for file ${index}`);
        const command = new AnalyzeDocumentCommand(params);
        const data = await client.send(command);
        console.log(`Received response from Textract for file ${index}`);

        console.log(`Processing structured data for file ${index}`);
        const result = processStructuredData(data);
        console.log(`Structured data processed for file ${index}:`, JSON.stringify(result, null, 2));

        return { index, ...result };
    } catch (error) {
        console.error(`Error in Textract analysis for file ${index}:`, error);
        return { index, error: `Textract analysis failed: ${error.message}` };
    }
}

function processStructuredData(data) {
    console.log('Starting to process structured data');
    const structuredData = {
        text: '',
        tables: []
    };

    if (data && data.Blocks) {
        console.log(`Processing ${data.Blocks.length} blocks`);
        const blocks = data.Blocks;
        structuredData.text = extractText(blocks);
        structuredData.tables = extractTables(blocks);
    } else {
        console.log('No blocks found in Textract response');
    }

    console.log('Finished processing structured data');
    return structuredData;
}

function extractText(blocks) {
    console.log('Extracting text from blocks');
    const text = blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .join('\n');
    console.log(`Extracted text (first 100 chars): ${text.substring(0, 100)}...`);
    return text;
}

function extractTables(blocks) {
    console.log('Extracting tables from blocks');
    const blockMap = {};
    const tableBlocks = [];

    blocks.forEach(block => {
        blockMap[block.Id] = block;
        if (block.BlockType === 'TABLE') {
            tableBlocks.push(block);
        }
    });

    const tables = tableBlocks.map(tableBlock => {
        return extractTable(tableBlock, blockMap);
    });

    console.log(`Extracted ${tables.length} tables`);
    return tables;
}

function extractTable(tableBlock, blockMap) {
    const table = {
        rows: []
    };

    const cellBlocks = getChildBlocks(tableBlock, blockMap, 'CELL');

    // Find the maximum row and column indices
    let maxRowIndex = 0;
    let maxColIndex = 0;

    const cellsByPosition = {};

    cellBlocks.forEach(cellBlock => {
        const rowIndex = cellBlock.RowIndex;
        const colIndex = cellBlock.ColumnIndex;

        if (rowIndex > maxRowIndex) maxRowIndex = rowIndex;
        if (colIndex > maxColIndex) maxColIndex = colIndex;

        const cellText = extractTextFromBlock(cellBlock, blockMap);
        const cellData = {
            text: cellText,
            colSpan: cellBlock.ColumnSpan || 1,
            rowSpan: cellBlock.RowSpan || 1
        };

        cellsByPosition[`${rowIndex}-${colIndex}`] = cellData;
    });

    // Build the table grid, accounting for empty cells and merged cells
    for (let rowIndex = 1; rowIndex <= maxRowIndex; rowIndex++) {
        const row = [];
        for (let colIndex = 1; colIndex <= maxColIndex; colIndex++) {
            const key = `${rowIndex}-${colIndex}`;
            if (cellsByPosition[key]) {
                row.push(cellsByPosition[key]);
            } else {
                row.push({ text: '', colSpan: 1, rowSpan: 1 }); // Empty cell
            }
        }
        table.rows.push(row);
    }

    return table;
}

function getChildBlocks(block, blockMap, blockType) {
    const childBlocks = [];
    if (block.Relationships) {
        block.Relationships.forEach(relationship => {
            if (relationship.Type === 'CHILD') {
                relationship.Ids.forEach(id => {
                    const childBlock = blockMap[id];
                    if (childBlock.BlockType === blockType) {
                        childBlocks.push(childBlock);
                    }
                });
            }
        });
    }
    return childBlocks;
}

function extractTextFromBlock(block, blockMap) {
    let text = '';
    if (block.Relationships) {
        block.Relationships.forEach(relationship => {
            if (relationship.Type === 'CHILD') {
                relationship.Ids.forEach(id => {
                    const childBlock = blockMap[id];
                    if (childBlock.BlockType === 'WORD') {
                        text += childBlock.Text + ' ';
                    } else if (childBlock.BlockType === 'SELECTION_ELEMENT' && childBlock.SelectionStatus === 'SELECTED') {
                        text += 'X ';
                    }
                });
            }
        });
    }
    return text.trim();
}

module.exports = { analyzeDocument };
