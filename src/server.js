// src/server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { analyzeDocument } = require('./textractService');

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
        return res.status(400).json({ error: 'No files uploaded' });
    }
    
    try {
        const results = await Promise.all(req.files.map(async (file, index) => {
            try {
                return await analyzeDocument(file, index + 1);
            } catch (error) {
                console.error(`Error analyzing file ${file.originalname}:`, error);
                return { index: index + 1, error: `Failed to analyze ${file.originalname}: ${error.message}` };
            }
        }));

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=analysis_results.txt');
        res.send(formatResultsAsTxt(results));
    } catch (error) {
        console.error('Error in analyze route:', error);
        res.status(500).json({ error: 'An error occurred during analysis', details: error.message });
    }
});

function formatResultsAsTxt(results) {
    return results.map((result) => {
        if (result.error) {
            return `Image ${result.index}\n\nError: ${result.error}\n\n`;
        }
        let output = `Image ${result.index}\n\n`;
        output += `Extracted Text:\n${result.text && result.text.length > 0 ? result.text.join('\n') : 'No text extracted'}\n\n`;
        
        output += 'Tables:\n';
        if (result.tables && result.tables.length > 0) {
            result.tables.forEach((table, index) => {
                output += `Table ${index + 1}:\n`;
                const columnWidths = table[0].map((_, colIndex) => 
                    Math.max(...table.map(row => row[colIndex].length))
                );
                table.forEach(row => {
                    output += '| ' + row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' | ') + ' |\n';
                });
                output += '\n';
            });
        } else {
            output += 'No tables found\n\n';
        }

        output += 'Forms:\n';
        if (result.forms && result.forms.length > 0) {
            result.forms.forEach(form => {
                output += `${form.key}: ${form.value}\n`;
            });
        } else {
            output += 'No forms found\n';
        }

        return output;
    }).join('\n---\n\n');
}

app.get('/test', (req, res) => {
    res.send('Server is working');
});

app.get('/', (req, res) => {
    res.send('Server is running');
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, (err) => {
    if (err) {
        console.error('Error starting server:', err);
    } else {
        console.log(`Server running on port ${PORT}`);
    }
});