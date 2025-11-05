#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const readline = require('readline');

const streamPipeline = promisify(pipeline);

const MODELS_DIR = __dirname;

const PIXEL_ART_MODELS = [
  {
    name: 'Example: ONNX Community ResNet-50',
    url: 'https://huggingface.co/onnx-community/resnet-50/resolve/main/model.onnx',
    filename: 'resnet-50.onnx',
    size: '~100MB',
    description: 'Example model - ResNet-50 for image classification (not pixel art specific, but publicly accessible for testing)'
  },
  {
    name: 'Example: ONNX Community MobileNet v3 Small',
    url: 'https://huggingface.co/onnx-community/mobilenet-v3-small/resolve/main/model.onnx',
    filename: 'mobilenet-v3-small.onnx',
    size: '~10MB',
    description: 'Example lightweight model for testing (publicly accessible, not pixel art specific)'
  },
  {
    name: 'Custom URL - For Your Pixel Art Model',
    url: null,
    filename: null,
    size: 'Unknown',
    description: 'Enter your own Hugging Face model URL or direct download link to an ONNX model'
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function downloadFile(url, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    console.log(`[INFO] Starting download from: ${url}`);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        console.log(`[INFO] Following redirect to: ${redirectUrl}`);
        return downloadFile(redirectUrl, outputPath, onProgress)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      let lastProgress = 0;
      
      const fileStream = fs.createWriteStream(outputPath);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const progress = Math.floor((downloadedSize / totalSize) * 100);
          if (progress !== lastProgress && progress % 5 === 0) {
            lastProgress = progress;
            if (onProgress) {
              onProgress(downloadedSize, totalSize, progress);
            }
          }
        }
      });
      
      streamPipeline(response, fileStream)
        .then(() => {
          console.log(`[SUCCESS] Download completed: ${formatBytes(downloadedSize)}`);
          resolve(outputPath);
        })
        .catch((err) => {
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch (unlinkErr) {
            }
          }
          reject(err);
        });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function selectModel() {
  console.log('\n=== Available Pixel Art ONNX Models ===\n');
  
  PIXEL_ART_MODELS.forEach((model, index) => {
    console.log(`${index + 1}. ${model.name}`);
    console.log(`   Size: ${model.size}`);
    console.log(`   Description: ${model.description}`);
    if (model.url) {
      console.log(`   URL: ${model.url}`);
    }
    console.log('');
  });
  
  const choice = await question('Select a model (1-' + PIXEL_ART_MODELS.length + ') or "q" to quit: ');
  
  if (choice.toLowerCase() === 'q') {
    return null;
  }
  
  const index = parseInt(choice, 10) - 1;
  
  if (isNaN(index) || index < 0 || index >= PIXEL_ART_MODELS.length) {
    console.log('[ERROR] Invalid selection');
    return await selectModel();
  }
  
  const selectedModel = PIXEL_ART_MODELS[index];
  
  if (!selectedModel.url) {
    const customUrl = await question('Enter the Hugging Face model URL: ');
    const customFilename = await question('Enter the output filename (e.g., my-model.onnx): ');
    return {
      url: customUrl,
      filename: customFilename,
      name: 'Custom Model'
    };
  }
  
  return selectedModel;
}

async function downloadModel(model, forceOverwrite = false) {
  const outputPath = path.join(MODELS_DIR, model.filename);
  
  if (fs.existsSync(outputPath) && !forceOverwrite) {
    const answer = await question(`[WARNING] File "${model.filename}" already exists. Overwrite? (y/n): `);
    if (answer.toLowerCase() !== 'y') {
      console.log(`[SKIP] Skipping download of "${model.filename}"`);
      return false;
    }
  }
  
  try {
    console.log(`\n[START] Downloading "${model.name}" to "${model.filename}"`);
    
    await downloadFile(model.url, outputPath, (downloaded, total, progress) => {
      console.log(`[PROGRESS] ${progress}% - ${formatBytes(downloaded)} / ${formatBytes(total)}`);
    });
    
    console.log(`[DONE] Model saved to: ${outputPath}\n`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to download "${model.name}": ${error.message}`);
    return false;
  }
}

async function downloadMultipleModels() {
  const models = [];
  
  while (true) {
    const model = await selectModel();
    if (!model) break;
    
    models.push(model);
    
    const more = await question('\nAdd another model? (y/n): ');
    if (more.toLowerCase() !== 'y') break;
  }
  
  if (models.length === 0) {
    console.log('[INFO] No models selected. Exiting.');
    return;
  }
  
  console.log(`\n[INFO] Preparing to download ${models.length} model(s)...\n`);
  
  let successCount = 0;
  for (const model of models) {
    const success = await downloadModel(model);
    if (success) successCount++;
  }
  
  console.log(`\n[SUMMARY] Downloaded ${successCount} out of ${models.length} model(s)`);
}

async function main() {
  console.log('========================================');
  console.log('  ONNX Model Downloader for Pixel Art  ');
  console.log('========================================\n');
  console.log('This script downloads ONNX models from Hugging Face');
  console.log('for pixel art generation.\n');
  console.log(`Target directory: ${MODELS_DIR}\n`);
  console.log('📝 NOTE: The pre-configured models are examples.');
  console.log('   For pixel art models, search Hugging Face for:');
  console.log('   - "pixel art onnx"');
  console.log('   - "stable diffusion onnx pixel"');
  console.log('   - "controlnet onnx"');
  console.log('   Then use the "Custom URL" option to download your chosen model.\n');
  console.log('💡 TIP: Make sure the model URL ends with .onnx and is publicly accessible.\n');
  
  try {
    await downloadMultipleModels();
  } catch (error) {
    console.error(`[ERROR] Unexpected error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { downloadFile, downloadModel, PIXEL_ART_MODELS };
