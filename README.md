# Image to Text Analyzer

A web application that analyzes images using AWS Textract to extract text, tables, and forms.

## Table of Contents
- [About](#about)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## About

This project is a web application that allows users to upload images (up to 20 at a time) and analyze them using AWS Textract. The application extracts text, tables, and forms from the uploaded images and provides the results in a downloadable text file.

Key features:
- Multiple image upload (up to 20 images)
- Drag and drop functionality
- Image preview with delete option
- Text extraction
- Table detection and formatting
- Form field extraction
- Results provided in a downloadable text file

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- AWS Services: AWS Textract
- Other technologies: 
  - Multer (for handling file uploads)
  - Sharp (for image processing)
  - dotenv (for environment variable management)

## Getting Started

These instructions will help you set up the project locally on your machine.

### Prerequisites

- Node.js (version 12.x or higher)
- npm (comes with Node.js)
- AWS account with Textract access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/image-to-text-analyzer.git
   ```

2. Navigate to the project directory:
   ```bash
   cd image-to-text-analyzer
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
     ```
     AWS_ACCESS_KEY_ID=your_aws_access_key
     AWS_SECRET_ACCESS_KEY=your_aws_secret_key
     AWS_REGION=your_aws_region
     ```

5. Start the development server:
   ```bash
   npm start
   ```

## Usage

1. Open a web browser and navigate to `http://localhost:3000` (or the port specified in your environment).
2. Click on the upload area or drag and drop images (up to 20) onto it.
3. Preview the uploaded images and remove any if needed.
4. Click the "Download" button to process the images and receive the analysis results.
5. The results will be downloaded as a text file named `analysis_results.txt`.

## License

This project is licensed under the ISC License.
