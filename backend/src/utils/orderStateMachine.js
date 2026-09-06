/**
 * 工单状态机
 * 定义工单状态转换规则和权限控制
 */

class OrderStateMachine {
  /**
   * 状态定义
   */
  static STATUS = {
    PENDING: 'pending',                   // 待确认
    CONFIRMED: 'confirmed',               // 已确认（已指派）
    IN_PROGRESS: 'in_progress',           // 施工中
    PENDING_REVIEW: 'pending_review',     // 完工待验收
    PRICE_NEGOTIATING: 'price_negotiating', // 价格协商中
    COMPLETED: 'completed',               // 已完成
    CANCELLED: 'cancelled'                // 已取消
  };

  /**
   * 操作定义
   */
  static ACTION = {
    ASSIGN: 'assign',           // 指派
    ACCEPT: 'accept',           // 接受
    REJECT: 'reject',           // 拒绝
    START: 'start',             // 开始施工
    COMPLETE: 'complete',       // 完工
    CONFIRM: 'confirm',         // 确认完成
    DISPUTE: 'dispute',         // 价格异议
    ADJUST_PRICE: 'adjust_price', // 调整价格
    CANCEL: 'cancel',           // 取消
    AUTO_COMPLETE: 'auto_complete' // 自动完成
  };

  /**
   * 角色定义
   */
  static ROLE = {
    CUSTOMER: 'customer',
    WORKER: 'worker',
    ADMIN: 'admin',
    SYSTEM: 'system'
  };

  /**
   * 状态转换规则
   * 格式：{ 当前状态: { 操作: { roles: [允许的角色], nextStatus: 下一个状态 } } }
   */
  static TRANSITIONS = {
    [OrderStateMachine.STATUS.PENDING]: {
      [OrderStateMachine.ACTION.ASSIGN]: {
        roles: [OrderStateMachine.ROLE.ADMIN],
        nextStatus: OrderStateMachine.STATUS.CONFIRMED,
        description: '管理员指派工单'
      },
      [OrderStateMachine.ACTION.CANCEL]: {
        roles: [OrderStateMachine.ROLE.CUSTOMER, OrderStateMachine.ROLE.ADMIN],
        nextStatus: OrderStateMachine.STATUS.CANCELLED,
        description: '客户或管理员取消工单'
      }
    },
    
    [OrderStateMachine.STATUS.CONFIRMED]: {
      [OrderStateMachine.ACTION.ACCEPT]: {
        roles: [OrderStateMachine.ROLE.WORKER],
        nextStatus: OrderStateMachine.STATUS.CONFIRMED,
        description: '师傅接受工单'
      },
      [OrderStateMachine.ACTION.REJECT]: {
        roles: [OrderStateMachine.ROLE.WORKER],
        nextStatus: OrderStateMachine.STATUS.PENDING,
        description: '师傅拒绝工单'
      },
      [OrderStateMachine.ACTION.START]: {
        roles: [OrderStateMachine.ROLE.WORKER],
        nextStatus: OrderStateMachine.STATUS.IN_PROGRESS,
        description: '师傅开始施工'
      },
      [OrderStateMachine.ACTION.CANCEL]: {
        roles: [OrderStateMachine.ROLE.CUSTOMER, OrderStateMachine.ROLE.ADMIN],
        nextStatus: OrderStateMachine.STATUS.CANCELLED,
        description: '客户或管理员取消工单'
      }
    },
    
    [OrderStateMachine.STATUS.IN_PROGRESS]: {
      [OrderStateMachine.ACTION.COMPLETE]: {
        roles: [OrderStateMachine.ROLE.WORKER],
        nextStatus: OrderStateMachine.STATUS.PENDING_REVIEW,
        description: '师傅完工'
      },
      [OrderStateMachine.ACTION.CANCEL]: {
        roles: [OrderStateMachine.ROLE.ADMIN],
        nextStatus: OrderStateMachine.STATUS.CANCELLED,
        description: '管理员取消工单'
      }
    },
    
    [OrderStateMachine.STATUS.PENDING_REVIEW]: {
      [OrderStateMachine.ACTION.CONFIRM]: {
        roles: [OrderStateMachine.ROLE.CUSTOMER],
        nextStatus: OrderStateMachine.STATUS.COMPLETED,
        description: '客户确认完成'
      },
      [OrderStateMachine.ACTION.DISPUTE]: {
        roles: [OrderStateMachine.ROLE.CUSTOMER],
        nextStatus: OrderStateMachine.STATUS.PRICE_NEGOTIATING,
        description: '客户对价格提出异议'
      },
      [OrderStateMachine.ACTION.AUTO_COMPLETE]: {
        roles: [OrderStateMachine.ROLE.SYSTEM],
        nextStatus: OrderStateMachine.STATUS.COMPLETED,
        description: '系统自动完成'
      }
    },
    
    [OrderStateMachine.STATUS.PRICE_NEGOTIATING]: {
      [OrderStateMachine.ACTION.ADJUST_PRICE]: {
        roles: [OrderStateMachine.ROLE.ADMIN],
        nextStatus: OrderStateMachine.STATUS.PENDING_REVIEW,
        description: '管理员调整价格'
      }
    },
    
    [OrderStateMachine.STATUS.COMPLETED]: {
      // 终态，无转换
    },
    
    [OrderStateMachine.STATUS.CANCELLED]: {
      // 终态，无转换
    }
  };

  /**
   * 检查是否可以执行操作
   * @param {string} currentStatus - 当前状态
   * @param {string} action - 操作
   * @param {string} role - 角色
   * @returns {boolean}
   */
  static canTransition(currentStatus, action, role) {
    const statusTransitions = this.TRANSITIONS[currentStatus];
    if (!statusTransitions) {
      return false;
    }

    const actionRule = statusTransitions[action];
    if (!actionRule) {
      return false;
    }

    return actionRule.roles.includes(role);
  }

  /**
   * 获取下一个状态
   * @param {string} currentStatus - 当前状态
   * @param {string} action - 操作
   * @returns {string|null}
   */
  static getNextStatus(currentStatus, action) {
    const statusTransitions = this.TRANSITIONS[currentStatus];
    if (!statusTransitions) {
      return null;
    }

    const actionRule = statusTransitions[action];
    if (!actionRule) {
      return null;
    }

    return actionRule.nextStatus;
  }

  /**
   * 获取操作描述
   * @param {string} currentStatus - 当前状态
   * @param {string} action - 操作
   * @returns {string|null}
   */
  static getActionDescription(currentStatus, action) {
    const statusTransitions = this.TRANSITIONS[currentStatus];
    if (!statusTransitions) {
      return null;
    }

    const actionRule = statusTransitions[action];
    if (!actionRule) {
      return null;
    }

    return actionRule.description;
  }

  /**
   * 获取当前状态允许的操作
   * @param {string} currentStatus - 当前状态
   * @param {string} role - 角色
   * @returns {Array<string>}
   */
  static getAvailableActions(currentStatus, role) {
    const statusTransitions = this.TRANSITIONS[currentStatus];
    if (!statusTransitions) {
      return [];
    }

    return Object.keys(statusTransitions).filter(action => {
      return statusTransitions[action].roles.includes(role);
    });
  }

  /**
   * 验证状态转换并返回结果
   * @param {string} currentStatus - 当前状态
   * @param {string} action - 操作
   * @param {string} role - 角色
   * @returns {{success: boolean, nextStatus?: string, error?: string}}
   */
  static validate(currentStatus, action, role) {
    // 检查当前状态是否存在
    if (!this.TRANSITIONS[currentStatus]) {
      return {
        success: false,
        error: `无效的工单状态: ${currentStatus}`
      };
    }

    // 检查操作是否存在
    const statusTransitions = this.TRANSITIONS[currentStatus];
    if (!statusTransitions[action]) {
      return {
        success: false,
        error: `当前状态 "${currentStatus}" 不支持操作 "${action}"`
      };
    }

    // 检查角色权限
    const actionRule = statusTransitions[action];
    if (!actionRule.roles.includes(role)) {
      return {
        success: false,
        error: `角色 "${role}" 无权执行操作 "${action}"`
      };
    }

    return {
      success: true,
      nextStatus: actionRule.nextStatus
    };
  }

  /**
   * 获取状态显示文本
   * @param {string} status - 状态
   * @returns {string}
   */
  static getStatusText(status) {
    const statusTexts = {
      [this.STATUS.PENDING]: '待确认',
      [this.STATUS.CONFIRMED]: '已确认',
      [this.STATUS.IN_PROGRESS]: '施工中',
      [this.STATUS.PENDING_REVIEW]: '完工待验收',
      [this.STATUS.PRICE_NEGOTIATING]: '价格协商中',
      [this.STATUS.COMPLETED]: '已完成',
      [this.STATUS.CANCELLED]: '已取消'
    };
    return statusTexts[status] || status;
  }

  /**
   * 检查是否为终态
   * @param {string} status - 状态
   * @returns {boolean}
   */
  static isFinalStatus(status) {
    return status === this.STATUS.COMPLETED || status === this.STATUS.CANCELLED;
  }

  /**
   * 检查是否可以取消
   * @param {string} status - 状态
   * @param {string} role - 角色
   * @returns {boolean}
   */
  static canCancel(status, role) {
    if (this.isFinalStatus(status)) {
      return false;
    }

    // 管理员可以取消任何非终态工单
    if (role === this.ROLE.ADMIN) {
      return true;
    }

    // 客户只能在施工前取消
    if (role === this.ROLE.CUSTOMER) {
      return status === this.STATUS.PENDING || status === this.STATUS.CONFIRMED;
    }

    return false;
  }
}

module.exports = OrderStateMachine;
