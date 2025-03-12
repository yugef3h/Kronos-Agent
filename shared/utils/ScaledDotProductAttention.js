// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Kronos-Agent Contributors

/**
 * 前端版缩放点积注意力实现
 * 核心：计算每个元素和其他元素的相关度，加权求和
 */
export class ScaledDotProductAttention {
  // 1. 初始化：定义Q(查询)、K(键)、V(值)（前端里用简单数组模拟）
  constructor() {
    // 示例：输入序列（比如要处理的代码片段）
    this.input = ["const", "a", "=", "10", ";", "console.log", "(", "a", ")"];
    // 简单映射：把文本转成数值向量（模拟词嵌入）
    this.embedding = {
      "const": [1, 0],
      "a": [0, 1],
      "=": [1, 1],
      "10": [2, 0],
      ";": [0, 2],
      "console.log": [3, 1],
      "(": [1, 2],
      ")": [2, 1]
    };
  }

  // 2. 计算Q和K的点积（相似度）
  dotProduct(q, k) {
    return q.reduce((sum, val, i) => sum + val * k[i], 0);
  }

  // 3. softmax函数：把分数归一化（总和=1）
  softmax(scores) {
    const expScores = scores.map(s => Math.exp(s));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(s => s / sumExp);
  }

  // 4. 核心：计算注意力输出
  calculate(queryIndex) {
    // 步骤1：获取Q/K/V的向量
    const Q = this.embedding[this.input[queryIndex]]; // 当前查询的向量
    const K = this.input.map(word => this.embedding[word]); // 所有键的向量
    const V = this.input.map(word => this.embedding[word]); // 所有值的向量
    const dk = Q.length; // 向量维度（这里是2）

    // 步骤2：计算Q和每个K的点积，再缩放
    const rawScores = K.map(k => this.dotProduct(Q, k) / Math.sqrt(dk));
    
    // 步骤3：softmax归一化，得到注意力权重
    const attentionWeights = this.softmax(rawScores);
    
    // 步骤4：权重乘以V，求和得到最终输出
    const output = V[0].map((_, i) => {
      return V.reduce((sum, v, j) => sum + attentionWeights[j] * v[i], 0);
    });

    // 打印结果（前端友好的格式）
    console.log(`==== 以"${this.input[queryIndex]}"为查询的注意力结果 ====`);
    console.log("输入序列：", this.input);
    console.log("注意力权重（分数越高越相关）：");
    this.input.forEach((word, i) => {
      console.log(`  ${word}: ${attentionWeights[i].toFixed(4)}`);
    });
    console.log("最终输出向量：", output.map(n => n.toFixed(4)));
    console.log("----------------------------------------");

    return { attentionWeights, output };
  }
}

// 运行Demo：计算"console.log"和其他元素的注意力
const attention = new ScaledDotProductAttention();
attention.calculate(5); // queryIndex=5 对应"console.log"