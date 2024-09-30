// src/server.js
require('dotenv').config(); // Ensure this is at the very top
const express = require('express');
const multer = require('multer');
const path = require('path');
const { analyzeDocument } = require('./textractService');
const ExcelJS = require('exceljs');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 20 } });

app.use(express.static('public'));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});


app.post('/analyze', upload.array('documents', 20), async (req, res) => {
    console.log('Analyze route hit');
    console.log('Files received:', req.files ? req.files.length : 0);
    
    if (!req.files || req.files.length === 0) {
        console.log('No files uploaded');
        return res.status(400).json({ error: 'No files uploaded' });
    }
    
    try {
        console.log('Starting analysis of uploaded files');
        const results = await Promise.all(req.files.map(async (file, index) => {
            try {
                console.log(`Analyzing file ${index + 1}: ${file.originalname}`);
                return await analyzeDocument(file, index + 1);
            } catch (error) {
                console.error(`Error analyzing file ${file.originalname}:`, error);
                return { index: index + 1, error: `Failed to analyze ${file.originalname}: ${error.message}` };
            }
        }));

        console.log('All files analyzed. Results:', JSON.stringify(results, null, 2));

        const format = req.query.format || 'txt';
        const extractionType = req.query.type || 'text';

        console.log(`Formatting results as ${format} for ${extractionType} extraction`);

        let formattedContent;
        if (format === 'csv') {
            formattedContent = formatResultsAsCsv(results, extractionType);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=analysis_results.csv');
        } else {
            formattedContent = formatResultsAsTxt(results, extractionType);
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename=analysis_results.txt');
        }
        
        console.log('Formatted content:', formattedContent);
        res.send(formattedContent);
        console.log('Response sent successfully');
    } catch (error) {
        console.error('Error in analyze route:', error);
        res.status(500).json({ error: 'An error occurred during analysis', details: error.message, stack: error.stack });
    }
});

function formatResultsAsTxt(results, extractionType) {
    console.log(`Formatting results as text for ${extractionType} extraction`);
    return results.map((result) => {
        if (result.error) {
            console.log(`Error for image ${result.index}: ${result.error}`);
            return `Image ${result.index}\n\nError: ${result.error}\n\n`;
        }
        let output = `Image ${result.index}\n\n`;
        if (extractionType === 'text') {
            console.log(`Formatting text for image ${result.index}`);
            output += 'Extracted Text:\n';
            output += result.text + '\n\n';
        } else if (extractionType === 'table') {
            console.log(`Formatting tables for image ${result.index}`);
            output += 'Tables:\n';
            if (result.tables && result.tables.length > 0) {
                result.tables.forEach((table, tableIndex) => {
                    console.log(`Formatting table ${tableIndex + 1} for image ${result.index}`);
                    output += `Table ${tableIndex + 1}:\n`;
                    table.rows.forEach((row, rowIndex) => {
                        output += row.join(' | ') + '\n';
                    });
                    output += '\n';
                });
            } else {
                console.log(`No tables found for image ${result.index}`);
                output += 'No tables found\n\n';
            }
        }
        return output;
    }).join('\n---\n\n');
}

function formatResultsAsCsv(results, extractionType) {
    console.log(`Formatting results as CSV for ${extractionType} extraction`);
    let csvContent = '';

    results.forEach((result, resultIndex) => {
        if (result.error) {
            console.log(`Error for image ${result.index}: ${result.error}`);
            csvContent += `Image ${result.index},Error: ${result.error}\n`;
        } else if (extractionType === 'text') {
            console.log(`Formatting text as CSV for image ${result.index}`);
            csvContent += `Image ${result.index},${(result.text || '').replace(/\n/g, ' ')}\n`;
        } else if (extractionType === 'table' && result.tables && result.tables.length > 0) {
            console.log(`Formatting tables as CSV for image ${result.index}`);
            result.tables.forEach((table, tableIndex) => {
                csvContent += `Table ${tableIndex + 1}\n`;
                table.rows.forEach(row => {
                    csvContent += row.map(cell => {
                        // Ensure cell is a string before calling replace
                        const cellText = (cell && typeof cell === 'object' && 'text' in cell) ? cell.text : String(cell || '');
                        return `"${cellText.replace(/"/g, '""')}"`;
                    }).join(',') + '\n';
                });
                csvContent += '\n';
            });
        } else {
            console.log(`No ${extractionType} found for image ${result.index}`);
            csvContent += `Image ${result.index},No ${extractionType === 'table' ? 'tables' : 'text'} found\n`;
        }
        
        if (resultIndex < results.length - 1) {
            csvContent += '\n';
        }
    });

    return csvContent;
}

app.get('/test', (req, res) => {
    res.send('Server is working');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;