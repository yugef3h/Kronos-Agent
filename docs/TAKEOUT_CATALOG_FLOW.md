# Takeout Catalog Flow

## Overview

外卖流程拆成两段：

1. `takeout/orchestrate` 只负责识别是否进入外卖流程，以及是否需要继续追问。
2. `takeout/catalog` 负责返回候选商品列表，前端再按既有卡片结构展示。

这样可以保持提示词足够短，同时避免把控制流和商品生成耦合在一个模型输出里。

## Catalog Response

`POST /api/takeout/catalog`

请求体：

```json
{
  "prompt": "下午想喝咖啡，来点不太甜的",
  "address": "上海市浦东新区张江高科技园区博云路2号"
}
```

响应体字段：

- `source`: `model` 或 `fallback`
- `address`: 当前配送地址
- `discount`: 当前优惠金额
- `delivery`: 配送信息
- `foods`: 候选商品列表

`foods` 里的关键字段仍保持前端既有 `TakeoutFood` 结构，避免重写卡片组件。

## Responsibilities

模型只生成少量关键信息：

- `shopName`
- `productName`
- `price`
- `combos`

后端补齐展示字段：

- `id`
- `shopScore`
- `distance`
- `productTip`
- `productImage`
- `priceTip`
- `deliveryTime`

如果模型不可用或输出不合法，后端自动回退到本地候选模板，保证外卖流程不断流。