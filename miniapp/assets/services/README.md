# 服务项目封面图片使用说明

## 图片文件清单

| 文件名 | 服务项目 | 尺寸建议 |
| --- | --- | --- |
| `bathroom.jpg` | 卫生间防水堵漏 | 实际施工场景照片 |
| `balcony.jpg` | 阳台防水翻新 | 阳台防水层施工照片 |
| `roof.jpg` | 屋顶防水施工 | 屋顶防水卷材施工照片 |
| `basement.jpg` | 地下室防潮处理 | 地下室渗漏问题照片 |
| `custom.jpg` | 定制防水施工 | 定制化标识图片 |

## 在小程序中使用

### 1. 后端接口返回

后端 API (`/api/services`) 返回服务列表时，在 `cover` 字段中返回图片路径：

```json
{
  "id": 1,
  "name": "卫生间防水堵漏",
  "description": "专业卫生间防水补漏服务，彻底解决渗漏问题",
  "price": 299,
  "unit": "起",
  "cover": "/assets/services/bathroom.jpg",
  "category_id": 1,
  "is_hot": true
}
```

### 2. 小程序组件展示

`rh-service-card` 组件会自动处理封面图片：

```xml
<!-- 如果有 cover 字段，显示实际图片 -->
<image wx:if="{{view.cover}}" class="rh-svc__cover" src="{{view.cover}}" mode="aspectFill" />

<!-- 如果没有 cover，显示渐变色+图标 -->
<view wx:else class="rh-svc__cover rh-svc__cover--grad" style="background: {{view.gradient}};">
  <rh-icon name="shield" tone="white" size="68" />
</view>
```

### 3. 开发环境测试

在开发环境中，可以使用 `utils/mock-services.js` 中的模拟数据进行测试：

```javascript
const { mockServices } = require('../../utils/mock-services');

Page({
  data: {
    services: []
  },
  
  onLoad() {
    // 开发环境使用模拟数据
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      this.setData({ services: mockServices });
    } else {
      // 生产环境调用真实 API
      this.loadServices();
    }
  }
});
```

### 4. 图片路径说明

- **相对路径**：`/assets/services/bathroom.jpg`
- **绝对路径**：`https://yourdomain.com/assets/services/bathroom.jpg`（生产环境建议使用 CDN）

小程序中推荐使用相对路径，图片会被打包到小程序包中。如果图片较大，建议：

1. 压缩图片（建议 < 200KB）
2. 使用 CDN 存储，通过完整 URL 访问
3. 考虑使用 WebP 格式以减小体积

## 图片优化建议

1. **尺寸**：建议 800x600 像素（4:3 比例）
2. **格式**：JPG 或 WebP
3. **质量**：80-85% 压缩质量即可
4. **大小**：单张不超过 200KB

## 后续维护

添加新服务图片时：

1. 将图片放到 `miniapp/assets/services/` 目录
2. 使用有意义的英文文件名（如 `kitchen.jpg`）
3. 更新后端数据库中对应服务的 `cover` 字段
4. 如需测试，更新 `utils/mock-services.js`