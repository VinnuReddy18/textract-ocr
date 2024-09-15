const AWS = require('aws-sdk');
const sharp = require('sharp');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const textract = new AWS.Textract();

async function analyzeDocument(file, index) {
    if (!file || !file.buffer) {
        throw new Error('Invalid file object');
    }

    console.log(`Analyzing file: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`);

    const resizedImage = await sharp(file.buffer)
        .resize(1500, 1500, { fit: 'inside' })
        .toBuffer();

    const params = {
        Document: {
            Bytes: resizedImage
        },
        FeatureTypes: ['TABLES', 'FORMS']
    };

    try {
        const data = await new Promise((resolve, reject) => {
            textract.analyzeDocument(params, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
        console.log('Raw Textract response:', JSON.stringify(data, null, 2));
        const result = processStructuredData(data);
        return { index, ...result };
    } catch (error) {
        console.error('Error in Textract analysis:', error);
        return { index, error: `Textract analysis failed: ${error.message}` };
    }
}

function processStructuredData(data) {
    const structuredData = {
        text: [],
        tables: [],
        forms: []
    };

    if (data && data.Blocks) {
        data.Blocks.forEach(block => {
            switch (block.BlockType) {
                case 'LINE':
                    if (block.Text) structuredData.text.push(block.Text);
                    break;
                case 'TABLE':
                    const table = extractTable(data.Blocks, block);
                    if (table.length > 0 && table[0].length > 0) {
                        structuredData.tables.push(table);
                    }
                    break;
                case 'KEY_VALUE_SET':
                    if (block.EntityTypes && block.EntityTypes.includes('KEY')) {
                        const form = extractForm(data.Blocks, block);
                        if (form && form.key && form.value) {
                            structuredData.forms.push(form);
                        }
                    }
                    break;
            }
        });
    }

    return structuredData;
}

function extractTable(blocks, tableBlock) {
    const table = [];
    const cellMap = new Map();

    blocks.forEach(block => {
        if (block.BlockType === 'CELL' && block.RowIndex && block.ColumnIndex) {
            const key = `${block.RowIndex}-${block.ColumnIndex}`;
            cellMap.set(key, block.Text || '');
        }
    });

    const rowCount = Math.max(...Array.from(cellMap.keys()).map(k => parseInt(k.split('-')[0])));
    const colCount = Math.max(...Array.from(cellMap.keys()).map(k => parseInt(k.split('-')[1])));

    for (let i = 1; i <= rowCount; i++) {
        const row = [];
        for (let j = 1; j <= colCount; j++) {
            row.push(cellMap.get(`${i}-${j}`) || '');
        }
        table.push(row);
    }

    return table;
}

function extractForm(blocks, keyBlock) {
    const valueRelationship = keyBlock.Relationships.find(rel => rel.Type === 'VALUE');
    if (!valueRelationship) return null;

    const valueBlock = blocks.find(block => valueRelationship.Ids.includes(block.Id));
    if (!valueBlock) return null;

    return {
        key: keyBlock.Text,
        value: valueBlock.Text
    };
}

module.exports = { analyzeDocument };