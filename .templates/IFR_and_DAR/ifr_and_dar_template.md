## 接口需求 (Interface Requirements)

### 用户接口需求 (User Interface Requirements)

#### IFR-UI-001: 用户登录界面
- **描述**: 用户登录界面的交互需求
- **接口类型**: Web用户界面
- **协议标准**: HTTP/HTTPS
- **输入要求**:
    - 用户名/邮箱 (必填)
    - 密码 (必填)
    - 记住我选项 (可选)
- **输出要求**:
    - 成功: 跳转到主页面
    - 失败: 显示错误提示
- **验证规则**:
    - 用户名长度3-50字符
    - 密码强度检查
- **用例依据**: 基于UC-001用户登录流程
- **相关用例**: [UC-001]
- **parent-req**: FR-AUTH-001

### 系统接口需求 (System Interface Requirements)

#### IFR-API-001: 用户认证API
- **描述**: 用户认证服务的API接口规约
- **接口类型**: RESTful API
- **协议标准**: HTTP/HTTPS
- **认证方式**: JWT Token
- **数据格式**: JSON
- **端点**: POST /api/auth/login
- **请求格式**:

```json
{
  "username": "string",
  "password": "string",
  "rememberMe": "boolean"
}
```

**响应格式**:

```json
{
  "success": "boolean",
  "token": "string",
  "user": "object",
  "message": "string"
}
```

- **错误处理**:
    - 401: 认证失败
    - 400: 参数错误
    - 500: 服务器错误
- **用例依据**: 基于UC-001用户登录中的"系统验证凭据"步骤
- **相关用例**: [UC-001]
- **parent-req**: FR-AUTH-001

### 外部接口需求 (External Interface Requirements)

#### IFR-EXT-001: 支付网关接口
- **描述**: 与第三方支付网关的集成接口
- **接口类型**: 第三方API集成
- **协议标准**: HTTPS
- **认证方式**: API Key + 签名验证
- **数据格式**: JSON
- **支持的支付方式**: 信用卡、支付宝、微信支付
- **超时设置**: 30秒
- **重试机制**: 最多3次重试
- **错误处理**:
    - 支付失败回滚
    - 网络异常重试
    - 金额不匹配拒绝
- **用例依据**: 基于UC-003支付流程中的"调用支付网关"步骤
- **相关用例**: [UC-003]
- **parent-req**: FR-PAY-001

## 数据需求 (Data Requirements)

### 用户数据需求 (User Data Requirements)

#### DAR-USER-001: 用户基本信息
- **描述**: 系统用户的基本信息数据要求
- **数据实体**: User
- **核心属性**:
    - user_id: 用户唯一标识符
    - username: 用户名
    - email: 邮箱地址
    - password_hash: 密码哈希值
    - created_at: 创建时间
    - updated_at: 更新时间
    - status: 用户状态
- **数据约束**:
    - user_id: 主键，自增整数
    - username: 唯一，3-50字符，字母数字下划线
    - email: 唯一，有效邮箱格式
    - password_hash: 非空，BCrypt加密
    - status: 枚举值(active, inactive, suspended)
- **数据类型**:
    - user_id: INTEGER PRIMARY KEY
    - username: VARCHAR(50) UNIQUE NOT NULL
    - email: VARCHAR(255) UNIQUE NOT NULL
    - password_hash: VARCHAR(255) NOT NULL
    - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    - status: ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
- **生命周期**:
- 创建: 用户注册时
    - 更新: 用户信息修改时
    - 删除: 软删除，状态改为inactive
    - 归档: 1年后归档到历史表
- **完整性规则**:
    - 用户名和邮箱必须唯一
    - 密码必须经过加密存储
    - 删除用户时保留关联数据的引用完整性
- **用例依据**: 基于UC-001用户登录和UC-002用户注册流程
- **相关用例**: [UC-001, UC-002]
- **source-requirement**: FR-AUTH-001

### 交易数据需求 (Transaction Data Requirements)

#### DAR-TXN-001: 交易记录
- **描述**: 系统交易记录的数据要求
- **数据实体**: Transaction
- **核心属性**:
    - transaction_id: 交易唯一标识符
    - user_id: 关联用户ID
    - amount: 交易金额
    - currency: 货币类型
    - type: 交易类型
    - status: 交易状态
    - created_at: 交易创建时间
    - completed_at: 交易完成时间
- **数据约束**:
    - transaction_id: 主键，UUID格式
    - user_id: 外键，关联用户表
    - amount: 正数，精确到小数点后2位
    - currency: ISO 4217货币代码
    - type: 枚举值(payment, refund, transfer)
    - status: 枚举值(pending, completed, failed, cancelled)
-**数据类型**:
    - transaction_id: VARCHAR(36) PRIMARY KEY
    - user_id: INTEGER FOREIGN KEY
    - amount: DECIMAL(10,2) NOT NULL
    - currency: VARCHAR(3) NOT NULL
    - type: ENUM('payment', 'refund', 'transfer') NOT NULL
    - status: ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending'
    - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - completed_at: TIMESTAMP NULL
- **生命周期**:
    - 创建: 交易发起时
    - 更新: 交易状态变化时
    - 保留: 永久保存，不删除
    - 归档: 3年后归档到历史表
- **完整性规则**:
    - 交易ID必须全局唯一
    - 用户ID必须存在于用户表中
    - 金额必须大于0
    - 完成时间必须晚于创建时间
- **合规要求**:
    - 符合PCI DSS标准
    - 满足金融监管要求
    - 支持审计追踪
- **用例依据**: 基于UC-003支付流程中的"记录交易信息"步骤
- **相关用例**: [UC-003]
- **source-requirement**: FR-PAY-001

### 系统日志需求 (System Log Requirements)

#### DAR-LOG-001: 操作日志
- **描述**: 系统操作日志的数据要求
- **数据实体**: AuditLog
- **核心属性**:
    - log_id: 日志唯一标识符
    - user_id: 操作用户ID
    - action: 操作类型
    - resource: 操作对象
    - timestamp: 操作时间
    - ip_address: 操作IP地址
    - user_agent: 用户代理信息
    - result: 操作结果
- **数据约束**:
    - log_id: 主键，自增长整数
    - user_id: 外键，可为空(匿名操作)
    - action: 非空，操作类型字符串
    - resource: 非空，操作对象标识
    - timestamp: 非空，精确到毫秒
    - ip_address: IPv4或IPv6格式
    - result: 枚举值(success, failure, error)
- **数据类型**:
    - log_id: BIGINT PRIMARY KEY AUTO_INCREMENT
    - user_id: INTEGER FOREIGN KEY NULL
    - action: VARCHAR(100) NOT NULL
    - resource: VARCHAR(255) NOT NULL
    - timestamp: TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3)
    - ip_address: VARCHAR(45) NOT NULL
    - user_agent: TEXT
    - result: ENUM('success', 'failure', 'error') NOT NULL
- **生命周期**:
    - 创建: 每次操作后立即记录
    - 更新: 不允许更新
    - 删除: 不允许删除
    - 归档: 6个月后归档到历史表
- **完整性规则**:
    - 日志记录一旦创建不可修改
    - 必须记录所有重要操作
    - 时间戳必须单调递增
- **用例依据**: 基于所有用例的操作审计需求
- **相关用例**: [UC-001, UC-002, UC-003]
- **source-requirement**: FR-AUDIT-001
