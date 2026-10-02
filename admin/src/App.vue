<template>
  <router-view />
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
}

@media (max-width: 768px) {
  .el-message {
    min-width: 0 !important;
    width: calc(100vw - 24px) !important;
  }
  .el-overlay .el-dialog {
    width: calc(100vw - 24px) !important;
    max-width: 100% !important;
    margin: 12px auto !important;
  }
  .el-drawer.rtl {
    width: 100% !important;
  }
  .el-pagination {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .el-form--inline .el-form-item {
    margin-right: 8px;
  }
}
</style>
