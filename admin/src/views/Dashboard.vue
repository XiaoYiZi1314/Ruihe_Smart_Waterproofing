<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <div class="stat-card stat-card--blue">
          <div class="stat-icon">
            <el-icon :size="28"><Tickets /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.orders.total || 0 }}</div>
            <div class="stat-label">总工单数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-card--orange">
          <div class="stat-icon">
            <el-icon :size="28"><Clock /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">待处理工单</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-card--green">
          <div class="stat-icon">
            <el-icon :size="28"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.orders.completed || 0 }}</div>
            <div class="stat-label">已完成工单</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-card--red">
          <div class="stat-icon">
            <el-icon :size="28"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.orders.exception || 0 }}</div>
            <div class="stat-label">异常工单</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 今日/本月数据 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>今日数据</template>
          <div class="today-stats">
            <div class="mini-stat">
              <div class="mini-value">{{ stats.today.new_orders || 0 }}</div>
              <div class="mini-label">新增工单</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value">{{ stats.today.completed_orders || 0 }}</div>
              <div class="mini-label">完成工单</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>本月数据</template>
          <div class="today-stats">
            <div class="mini-stat">
              <div class="mini-value">{{ stats.month.new_orders || 0 }}</div>
              <div class="mini-label">新增工单</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value">{{ stats.month.completed_orders || 0 }}</div>
              <div class="mini-label">完成工单</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value">¥{{ stats.month.total_revenue || 0 }}</div>
              <div class="mini-label">完成订单总额</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 工单完成趋势 -->
    <el-card shadow="never" class="trend-card">
      <template #header>
        <div class="trend-header">
          <span>工单趋势</span>
          <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
            <el-radio-button :value="7">近7天</el-radio-button>
            <el-radio-button :value="30">近30天</el-radio-button>
            <el-radio-button :value="90">近90天</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div ref="trendChartRef" class="trend-chart" v-loading="trendLoading"></div>
    </el-card>

    <el-row :gutter="20">
      <!-- 工单状态分布 -->
      <el-col :span="12">
        <el-card shadow="never" class="status-card-box">
          <template #header>工单状态分布</template>
          <div class="status-distribution">
            <div
              v-for="item in statusDistribution"
              :key="item.label"
              class="status-bar-item"
            >
              <div class="bar-item-label">
                <span>{{ item.label }}</span>
                <span>{{ item.value }}</span>
              </div>
              <el-progress
                :percentage="item.percentage"
                :color="item.color"
                :stroke-width="12"
                :show-text="false"
              />
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 师傅排行榜 -->
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>师傅本月完成排行</template>
          <el-table :data="workerRanking" v-loading="rankingLoading" size="small">
            <el-table-column label="排名" width="60" align="center">
              <template #default="{ $index }">
                <span
                  class="rank-badge"
                  :class="`rank-${$index + 1}`"
                  v-if="$index < 3"
                >{{ $index + 1 }}</span>
                <span v-else>{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="nickname" label="师傅" width="100" />
            <el-table-column prop="completed_count" label="完成数" width="80" align="center" />
            <el-table-column label="完成金额" width="110" align="right">
              <template #default="{ row }">
                ¥{{ row.total_revenue }}
              </template>
            </el-table-column>
            <el-table-column label="平均评分" align="center">
              <template #default="{ row }">
                <span v-if="row.avg_score > 0" class="score">⭐ {{ row.avg_score }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import api from '../api';

const stats = ref({
  orders: {},
  workers: {},
  today: {},
  month: {}
});

const pendingCount = computed(() => {
  const o = stats.value.orders || {};
  return (
    Number(o.pending || 0) +
    Number(o.confirmed || 0) +
    Number(o.in_progress || 0) +
    Number(o.pending_review || 0) +
    Number(o.price_negotiating || 0)
  );
});

const statusDistribution = computed(() => {
  const o = stats.value.orders || {};
  const total = o.total || 0;
  const items = [
    { label: '待指派', value: o.pending || 0, color: '#f59e0b' },
    { label: '待接单', value: o.confirmed || 0, color: '#3b82f6' },
    { label: '施工中', value: o.in_progress || 0, color: '#10b981' },
    { label: '待验收', value: o.pending_review || 0, color: '#8b5cf6' },
    { label: '价格协商', value: o.price_negotiating || 0, color: '#ec4899' },
    { label: '已完成', value: o.completed || 0, color: '#6366f1' },
    { label: '已取消', value: o.cancelled || 0, color: '#9ca3af' }
  ];
  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
  }));
});

// 趋势图
const trendChartRef = ref();
const trendDays = ref(30);
const trendLoading = ref(false);
let chartInstance = null;

async function loadTrend() {
  trendLoading.value = true;
  try {
    const res = await api.get('/admin/dashboard/trend', {
      params: { days: trendDays.value }
    });
    const trend = res.data.trend || [];

    await nextTick();
    if (!chartInstance && trendChartRef.value) {
      chartInstance = echarts.init(trendChartRef.value);
    }
    if (chartInstance) {
      chartInstance.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' }
        },
        legend: {
          data: ['新增工单', '完成工单']
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: trend.map((t) => t.date.slice(5)),
          boundaryGap: false
        },
        yAxis: {
          type: 'value',
          minInterval: 1
        },
        series: [
          {
            name: '新增工单',
            type: 'line',
            smooth: true,
            data: trend.map((t) => t.new_orders),
            itemStyle: { color: '#2b7be4' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(43, 123, 228, 0.25)' },
                { offset: 1, color: 'rgba(43, 123, 228, 0)' }
              ])
            }
          },
          {
            name: '完成工单',
            type: 'line',
            smooth: true,
            data: trend.map((t) => t.completed_orders),
            itemStyle: { color: '#10b981' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0)' }
              ])
            }
          }
        ]
      });
    }
  } catch (err) {
    // 拦截器已处理
  } finally {
    trendLoading.value = false;
  }
}

// 师傅排行榜
const workerRanking = ref([]);
const rankingLoading = ref(false);

async function loadRanking() {
  rankingLoading.value = true;
  try {
    const res = await api.get('/admin/dashboard/worker-ranking', {
      params: { limit: 10 }
    });
    workerRanking.value = res.data.ranking || [];
  } catch (err) {
    // 拦截器已处理
  } finally {
    rankingLoading.value = false;
  }
}

async function loadStats() {
  try {
    const res = await api.get('/admin/dashboard');
    stats.value = res.data;
  } catch (err) {
    // 拦截器已处理
  }
}

function handleResize() {
  if (chartInstance) chartInstance.resize();
}

function refreshDashboard() {
  loadStats();
  loadTrend();
  loadRanking();
}

onMounted(() => {
  loadStats();
  loadTrend();
  loadRanking();
  window.addEventListener('resize', handleResize);
  window.addEventListener('ruihe:orders-changed', refreshDashboard);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('ruihe:orders-changed', refreshDashboard);
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped>
.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-card--blue .stat-icon { background: linear-gradient(135deg, #1a5cff, #2b7be4); }
.stat-card--orange .stat-icon { background: linear-gradient(135deg, #f59e0b, #f97316); }
.stat-card--green .stat-icon { background: linear-gradient(135deg, #10b981, #34d399); }
.stat-card--red .stat-icon { background: linear-gradient(135deg, #ef4444, #f87171); }

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #1f2937;
}

.stat-label {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 4px;
}

.today-stats {
  display: flex;
  justify-content: space-around;
}

.mini-stat {
  text-align: center;
}

.mini-value {
  font-size: 24px;
  font-weight: bold;
  color: #1f2937;
}

.mini-label {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 4px;
}

.trend-card {
  margin-bottom: 20px;
}

.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trend-chart {
  height: 320px;
  width: 100%;
}

.status-card-box {
  margin-bottom: 20px;
}

.status-distribution {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 600px;
}

.bar-item-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
}

.rank-1 { background: #f59e0b; }
.rank-2 { background: #9ca3af; }
.rank-3 { background: #d97706; }

.score {
  color: #f59e0b;
  font-weight: 600;
}
</style>
