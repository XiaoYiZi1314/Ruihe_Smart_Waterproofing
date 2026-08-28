/**
 * 服务项目模拟数据
 * 用于开发环境测试，展示如何使用服务封面图片
 */

const mockServices = [
  {
    id: 1,
    name: '卫生间防水堵漏',
    description: '专业卫生间防水补漏服务，彻底解决渗漏问题',
    price: 299,
    unit: '起',
    cover: '/assets/services/bathroom.jpg',
    category_id: 1,
    is_hot: true
  },
  {
    id: 2,
    name: '阳台防水翻新',
    description: '阳台防水层老化翻新，有效防止雨水渗透',
    price: 399,
    unit: '起',
    cover: '/assets/services/balcony.jpg',
    category_id: 1,
    is_hot: true
  },
  {
    id: 3,
    name: '屋顶防水施工',
    description: '专业屋顶防水施工，长效防护不渗漏',
    price: 599,
    unit: '起',
    cover: '/assets/services/roof.jpg',
    category_id: 2,
    is_hot: true
  },
  {
    id: 4,
    name: '地下室防潮处理',
    description: '地下室防潮防霉专业处理，创造干爽环境',
    price: 799,
    unit: '起',
    cover: '/assets/services/basement.jpg',
    category_id: 2,
    is_hot: false
  },
  {
    id: 5,
    name: '定制防水施工',
    description: '根据实际情况定制防水方案，专业团队施工',
    price: 0,
    unit: '面议',
    cover: '/assets/services/custom.jpg',
    category_id: 3,
    is_hot: false
  }
];

module.exports = {
  mockServices
};