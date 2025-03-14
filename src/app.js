// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Kronos-Agent Contributors

// 1. 引入最新Transformers.js v4
import { pipeline, AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.4/+esm';

// 全局配置（v4新API）
const config = {
  device: 'webgpu', // 启用WebGPU加速（必须）
  quantized: true,  // 启用8位量化（减少内存）
  cache_dir: './models_cache' // 本地缓存模型
};

let generator; // 文本生成管道
let tokenizer; // 分词器


// 2. 初始化模型（v4新初始化方式）
async function initModel() {
  try {
    // 使用公开模型
    const MODEL_ID = 'Xenova/distilgpt2';
    document.getElementById('status').textContent = '加载模型中（首次会下载，约10MB）...';
    
    // 初始化分词器（GPT2专用）
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, config);
    
    // 初始化文本生成管道（v4新API）
    generator = await pipeline(
      'text-generation',
      MODEL_ID,
      config
    );
    
    document.getElementById('status').textContent = '✅ 模型加载完成，支持WebGPU加速！';
    document.getElementById('prompt').disabled = false;
  } catch (error) {
    console.error('初始化失败:', error);
    document.getElementById('status').textContent = `❌ 加载失败: ${error.message}`;
  }
}

// 3. 文本生成（v4新生成参数）
async function generateText() {
  if (!generator) return alert('模型未加载完成');
  
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) return alert('请输入提示词');
  
  document.getElementById('status').textContent = '生成中...';
  document.getElementById('output').textContent = '';
  
  try {
    const result = await generator(prompt, {
      max_new_tokens: 100,    // 最大生成token数
      temperature: 0.7,       // 随机性（0-1）
      top_p: 0.9,             // 核采样
      repetition_penalty: 1.1,// 重复惩罚
      do_sample: true,        // 启用采样
      pad_token_id: tokenizer.pad_token_id,
      eos_token_id: tokenizer.eos_token_id
    });
    console.log('生成结果:', result);
    
    document.getElementById('output').textContent = result[0].generated_text;
    document.getElementById('status').textContent = '✅ 生成完成！';
  } catch (error) {
    console.error('生成失败:', error);
    document.getElementById('status').textContent = `❌ 生成失败: ${error.message}`;
  }
}

// 4. 手写自注意力机制（对应掘金核心）
function causalSelfAttention(x, numHeads = 2) {
  const seqLen = x.length;
  const headDim = x[0].length / numHeads;
  
  // 1. 拆分多头
  const splitHeads = (tensor) => {
    return Array(numHeads).fill(0).map((_, h) => 
      tensor.map(vec => vec.slice(h * headDim, (h + 1) * headDim))
    );
  };
  
  // 2. 计算Q/K/V（模拟）
  const q = splitHeads(x);
  const k = splitHeads(x);
  const v = splitHeads(x);
  
  // 3. 因果遮罩（只能看前面）
  const mask = Array(seqLen).fill(0).map((_, i) => 
    Array(seqLen).fill(0).map((_, j) => j > i ? -Infinity : 0)
  );
  
  // 4. 计算注意力分数
  const attnScores = q.map((qHead, h) => 
    qHead.map((qVec, i) => 
      k[h].map((kVec, j) => 
        qVec.reduce((sum, val, idx) => sum + val * kVec[idx], 0) / Math.sqrt(headDim) + mask[i][j]
      )
    )
  );
  
  // 5. Softmax
  const softmax = (arr) => {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  };
  
  const attnProbs = attnScores.map(head => head.map(row => softmax(row)));
  
  // 6. 加权求和
  const output = attnProbs.map((probsHead, h) => 
    probsHead.map((row, i) => 
      v[h].reduce((sum, vec, j) => 
        sum.map((val, idx) => val + vec[idx] * row[j]),
        Array(headDim).fill(0)
      )
    )
  );
  
  // 7. 合并多头
  return output[0].map((_, i) => 
    output.flatMap(head => head[i])
  );
}

// 5. 手写Transformer Block（对应掘金）
function transformerBlock(x) {
  // 1. 自注意力 + 残差
  const attn = causalSelfAttention(x);
  const attnRes = x.map((vec, i) => vec.map((val, j) => val + attn[i][j]));
  
  // 2. 层归一化（简化版）
  const layerNorm = (vec) => {
    const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
    const std = Math.sqrt(vec.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vec.length + 1e-5);
    return vec.map(val => (val - mean) / std);
  };
  const norm1 = attnRes.map(vec => layerNorm(vec));
  
  // 3. MLP + 残差
  const mlp = norm1.map(vec => vec.map(val => val * 2 + Math.random() * 0.1));
  const mlpRes = norm1.map((vec, i) => vec.map((val, j) => val + mlp[i][j]));
  
  // 4. 第二次归一化
  return mlpRes.map(vec => layerNorm(vec));
}

// 6. 测试自注意力与Transformer Block
async function testCoreComponents() {
  console.log('=== 测试自注意力机制 ===');
  const testInput = [[1,2,3,4], [5,6,7,8], [9,10,11,12]]; // 3x4 输入
  const attnOutput = causalSelfAttention(testInput);
  console.log('自注意力输出:', attnOutput);
  
  console.log('=== 测试Transformer Block ===');
  const blockOutput = transformerBlock(testInput);
  console.log('Transformer Block输出:', blockOutput);
}

// 页面加载时初始化
window.onload = async () => {
  await initModel();
  await testCoreComponents(); // 测试核心组件
  window.generateText = generateText;
};
