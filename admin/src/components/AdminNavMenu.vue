<template>
  <el-menu
    :default-active="active"
    router
    background-color="#1f2937"
    text-color="#9ca3af"
    active-text-color="#ffffff"
    class="aside-menu"
    @select="$emit('select')"
  >
    <el-menu-item index="/dashboard">
      <el-icon><DataAnalysis /></el-icon>
      <span>数据看板</span>
    </el-menu-item>
    <el-menu-item index="/orders">
      <el-icon><Tickets /></el-icon>
      <span>工单管理</span>
    </el-menu-item>
    <el-menu-item index="/workers">
      <el-icon><User /></el-icon>
      <span>师傅管理</span>
    </el-menu-item>
    <el-menu-item index="/corrections">
      <el-icon><EditPen /></el-icon>
      <span>更正复盘</span>
    </el-menu-item>
    <el-sub-menu index="content">
      <template #title>
        <el-icon><Goods /></el-icon>
        <span>项目管理</span>
      </template>
      <el-menu-item index="/categories">服务分类</el-menu-item>
      <el-menu-item index="/services">服务项目</el-menu-item>
    </el-sub-menu>
    <el-menu-item index="/site-config">
      <el-icon><Setting /></el-icon>
      <span>站点配置</span>
    </el-menu-item>
    <el-menu-item index="/logs">
      <el-icon><Document /></el-icon>
      <span>操作日志</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
defineProps({
  active: { type: String, required: true }
});
defineEmits(['select']);
</script>

<style scoped>
.aside-menu {
  border-right: none;
  flex: 1;
}

.aside-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #1a5cff, #2b7be4);
}
</style>
