# 一主多从部署方案（Caddy 请求分流）

本文档说明如何以 **一主多从** 架构部署 New API，并用 **Caddy** 做 TLS 终结与请求分流/负载均衡。

> 官方集群说明可参考：[集群部署](https://docs.newapi.ai/zh/docs/installation/deployment-methods/cluster-deployment)

***

## 架构概览

```
                    ┌─────────────────────────────────────┐
                    │  Caddy（api.wingrid.tech）            │
                    │  手动 TLS → 分流 / 健康检查           │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┼───────────────────────┐
           │ 控制面（管理后台 / Web） │ 数据面（API 转发）       │
           ▼                       │                       ▼
   ┌─────────────────┐             │         ┌────────────────────────────┐
   │ Master          │◄────────────┘         │ Slave-1 / Slave-2 / ...    │
   │ 127.0.0.1:3888  │                       │ NODE_TYPE=slave            │
   │ （本机 compose） │                       │ SLAVE_IP:3888              │
   └───────┬─────────┘                       └─────────────┬──────────────┘
           │                                               │
           └──────────────────┬────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │ 共享 PostgreSQL（或 MySQL）     │
              │ 共享 Redis（推荐）              │
              └───────────────────────────────┘
```

### 主从职责

| 角色 | 启动命令中的注入 | 职责 |
|------|------------------|------|
| **主节点** | `NODE_TYPE=master` | 数据库迁移、系统定时任务、授权策略初始化、可承接管理后台与部分 API |
| **从节点** | `NODE_TYPE=slave` | 不跑迁移/后台任务；主要承接 API 转发，横向扩展吞吐 |

> 程序判定：`NODE_TYPE != "slave"` 即为主节点。Compose 通过启动命令 `env NODE_TYPE=... /new-api ...` 注入，无需在 `environment` 里再写一份。

***

## 前置要求

| 项目 | 要求 |
|------|------|
| 服务器 | ≥ 2 台（1 主 + N 从）；Caddy 可与主同机，或独立入口机 |
| 运行时 | Docker + Docker Compose |
| 数据库 | **所有节点共用同一可写库**（推荐 PostgreSQL ≥ 9.6；MySQL ≥ 5.7.8 亦可） |
| Redis | **强烈推荐所有节点共用同一 Redis**（限流/缓存跨节点一致） |
| 域名 | 已解析到 Caddy 所在机器的公网 IP（用于自动签发证书） |
| 端口 | 本机主节点对外 `3888`（compose `3888:3000`）；从节点对 Caddy 可达；Caddy 开放 `80/443` |

***

## 关键配置（所有节点必须一致）

1. **同一 `SQL_DSN`**：指向同一个可写数据库入口
2. **同一 `SESSION_SECRET`**：否则登录态在节点间失效
3. **共享 Redis 时同一 `CRYPTO_SECRET`**：否则缓存数据无法解密
4. **正确的角色启动命令**：主用 `NODE_TYPE=master`，从用 `NODE_TYPE=slave`（见下方 compose）
5. **建议设置稳定的 `NODE_NAME`**：写在启动命令里，便于审计日志区分节点

生成密钥：

```bash
openssl rand -hex 32   # SESSION_SECRET / CRYPTO_SECRET 各生成一次
```

### Redis 拓扑选择

| 拓扑 | Session / 限流语义 | 推荐场景 |
|------|-------------------|----------|
| **共享 Redis**（推荐） | 撤销即时、限流额度集群共享 | 生产一主多从 |
| 每节点独立 Redis | 最多约 `SYNC_FREQUENCY` 秒陈旧；限流按节点独立计数 | 临时扩容、弱一致可接受 |
| 无 Redis | Session 直接查库；内存限流按节点 | 小流量试验 |

***

## 脚本一览（`deploy/master-slave/`）

| 脚本 | 作用 |
|------|------|
| [`build.sh`](../../deploy/master-slave/build.sh) | 从仓库根目录 `Dockerfile` 构建本地镜像（默认 `wingrid-api:local`） |
| [`start-master.sh`](../../deploy/master-slave/start-master.sh) | 启动主节点（`NODE_TYPE=master` + 本机 Redis） |
| [`start-slave.sh`](../../deploy/master-slave/start-slave.sh) | 启动从节点（`NODE_TYPE=slave`） |

```bash
cd deploy/master-slave
cp .env.example .env && chmod 600 .env
# 编辑 .env：SQL_DSN / REDIS_* / SESSION_SECRET / CRYPTO_SECRET

./build.sh                 # 构建镜像
./start-master.sh          # 主节点
./start-slave.sh new-api-slave-1   # 从节点（每台换唯一 NODE_NAME）
```

常用参数：

```bash
./build.sh --no-cache
./start-master.sh --build --logs   # 构建并启动，随后跟日志
./start-master.sh --down           # 停止主节点
./start-slave.sh --restart new-api-slave-2
```

***

## 步骤一：部署主节点

示例文件：[`deploy/master-slave/docker-compose.master.yml`](../../deploy/master-slave/docker-compose.master.yml)

主从用 **启动命令** 区分（程序本身只认环境变量 `NODE_TYPE`，由 `command` 在进程启动时注入）：

```yaml
entrypoint: ["/bin/sh", "-c"]
command:
  - exec env NODE_TYPE=master NODE_NAME=${NODE_NAME:-new-api-master} /new-api --log-dir /app/logs
```

```bash
cd deploy/master-slave
cp .env.example .env   # 填写 SQL_DSN / REDIS_* / SESSION_SECRET / CRYPTO_SECRET
./build.sh
./start-master.sh
# 等价于：
# docker compose -f docker-compose.master.yml --env-file .env up -d
curl -sS http://127.0.0.1:3888/api/status
```

***

## 步骤二：部署从节点

示例文件：[`deploy/master-slave/docker-compose.slave.yml`](../../deploy/master-slave/docker-compose.slave.yml)

从节点启动命令（每台只改 `NODE_NAME`）：

```yaml
entrypoint: ["/bin/sh", "-c"]
command:
  - exec env NODE_TYPE=slave NODE_NAME=${NODE_NAME:-new-api-slave-1} /new-api --log-dir /app/logs
```

```bash
cd deploy/master-slave
cp .env.example .env
# .env 中 SESSION_SECRET / CRYPTO_SECRET / SQL_DSN 必须与主节点一致
# 填写 MASTER_HOST=主节点IP，公用主节点 new-api-redis:6379
./build.sh
./start-slave.sh local new-api-slave-1
curl -sS http://127.0.0.1:3888/api/status
```

对 `slave-2`、`slave-3`… 重复部署，仅换 `NODE_NAME`：`./start-slave.sh new-api-slave-2`。

***

## 步骤三：Caddy 请求分流

### 当前线上 Caddy 现状

入口机已有完整 Caddyfile，与 New API 相关的站点是：

| 站点 | 现状 | 一主多从改造 |
|------|------|--------------|
| `api.wingrid.tech` | 手动证书 → `127.0.0.1:3888`（本机主节点，对应 compose `3888:3000`） | **改这一段**做控制面/数据面分流 |
| `ai.wormholexyz.xyz` | Let's Encrypt → 同一 `127.0.0.1:3888` | 可选：与 api 共用同一套上游，或继续只指本机主节点 |
| 其它站点（`mp` / `img` / `www` / `epay`） | 无关 | **不要动** |

当前片段：

```caddyfile
api.wingrid.tech {
	tls /etc/caddy/api-wingrid-cert.pem /etc/caddy/api-wingrid-key.pem
	reverse_proxy http://127.0.0.1:3888
}
```

### 推荐策略：控制面钉主，数据面打满从节点

| 流量类型 | 路径示例 | 上游 |
|----------|----------|------|
| 控制面 | `/`（Web）、`/api/*`、`/dashboard/*`、`/pg/*` | **仅本机主节点** `127.0.0.1:3888` |
| 数据面 | `/v1/*`、`/v1beta/*`、`/mj/*`、`/suno/*` | **主 + 从**（从节点权重更高） |

### 替换 `api.wingrid.tech` 站点块

只改这一段，其余站点原样保留。把 `SLAVE1_IP` / `SLAVE2_IP` 换成从节点可达地址；从节点若同样用 Docker 映射 `3888:3000`，上游端口写 `3888`，否则写实际对外端口。

```caddyfile
api.wingrid.tech {
	tls /etc/caddy/api-wingrid-cert.pem /etc/caddy/api-wingrid-key.pem

	encode gzip zstd

	# —— 控制面：只打本机主节点 ——
	handle /api/* {
		reverse_proxy http://127.0.0.1:3888 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
		}
	}

	handle /dashboard/* {
		reverse_proxy http://127.0.0.1:3888
	}

	handle /pg/* {
		reverse_proxy http://127.0.0.1:3888 {
			flush_interval -1
		}
	}

	# —— 数据面：主 + 从（权重 1:3:3，从节点吃更多转发流量）——
	# 从节点未就绪前可先只留 127.0.0.1:3888，扩容后再追加上游
	handle /v1/* {
		reverse_proxy http://127.0.0.1:3888 http://SLAVE1_IP:3888 http://SLAVE2_IP:3888 {
			lb_policy weighted_round_robin 1 3 3
			lb_try_duration 5s
			fail_duration 30s
			max_fails 3
			unhealthy_status 5xx
			health_uri /api/status
			health_interval 15s
			health_timeout 3s
			flush_interval -1

			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up Connection {>Connection}
			header_up Upgrade {>Upgrade}

			transport http {
				read_timeout  30m
				write_timeout 30m
				dial_timeout  10s
			}
		}
	}

	handle /v1beta/* {
		reverse_proxy http://127.0.0.1:3888 http://SLAVE1_IP:3888 http://SLAVE2_IP:3888 {
			lb_policy weighted_round_robin 1 3 3
			health_uri /api/status
			health_interval 15s
			flush_interval -1
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
			transport http {
				read_timeout  30m
				write_timeout 30m
			}
		}
	}

	handle /mj/* {
		reverse_proxy http://127.0.0.1:3888 http://SLAVE1_IP:3888 http://SLAVE2_IP:3888 {
			lb_policy weighted_round_robin 1 3 3
			flush_interval -1
		}
	}

	handle /suno/* {
		reverse_proxy http://127.0.0.1:3888 http://SLAVE1_IP:3888 http://SLAVE2_IP:3888 {
			lb_policy weighted_round_robin 1 3 3
			flush_interval -1
		}
	}

	# 前端 SPA / 静态资源等钉主
	handle {
		reverse_proxy http://127.0.0.1:3888
	}

	log {
		output file /var/log/caddy/api-wingrid-access.log
		format json
	}
}
```

说明：

- 证书路径保持现状，**不要**改成 `tls email@...`，以免影响已有手动证书
- `flush_interval -1`：流式补全 / SSE 必开，避免被缓冲成整包
- 健康检查打各上游的 `/api/status`；从节点防火墙需允许 **Caddy 入口机** 访问其 `3888`
- 权重 `1 3 3`：主轻载控制面，数据面主要由从节点扛

加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### `ai.wormholexyz.xyz` 怎么处理

当前也指向本机 `3888`。二选一：

**A. 与 api 同源分流（推荐，若该域名也对外提供 API）**

把上面 `api.wingrid.tech { ... }` 里的 `handle` / `reverse_proxy` 整段复制到 `ai.wormholexyz.xyz`，仅保留其 `tls carmine.joint@gmail.com`。

**B. 仅作别名，继续单点主节点**

```caddyfile
ai.wormholexyz.xyz {
	tls carmine.joint@gmail.com
	reverse_proxy http://127.0.0.1:3888
	log {
		output file /var/log/caddy/access.log
		format json
	}
}
```

### 备选：全路径统一负载均衡

运维更简单，管理后台也可打到任意节点（仍依赖共享 DB/Redis + 统一 `SESSION_SECRET`）：

```caddyfile
api.wingrid.tech {
	tls /etc/caddy/api-wingrid-cert.pem /etc/caddy/api-wingrid-key.pem

	reverse_proxy http://127.0.0.1:3888 http://SLAVE1_IP:3888 http://SLAVE2_IP:3888 {
		lb_policy weighted_round_robin 2 5 5
		health_uri /api/status
		health_interval 15s
		flush_interval -1
		header_up X-Forwarded-Proto {scheme}
		header_up X-Real-IP {remote_host}
		transport http {
			read_timeout  30m
			write_timeout 30m
		}
	}
}
```

> 即使流量可打到从节点，**迁移与系统定时任务仍只在主节点执行**，从节点必须 `NODE_TYPE=slave`。

***

## 步骤四：验证

```bash
# 1) HTTPS 与健康
curl -sS https://api.wingrid.tech/api/status

# 2) 控制面应落到主（对照 NODE_NAME 日志）
curl -sS -o /dev/null -w "%{http_code}\n" https://api.wingrid.tech/

# 3) 数据面多次请求，观察各节点是否分流
for i in $(seq 1 20); do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer sk-xxx" \
    https://api.wingrid.tech/v1/models
done

# 4) 流式（应持续输出，不被缓冲）
curl -N https://api.wingrid.tech/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","stream":true,"messages":[{"role":"user","content":"hi"}]}'
```

管理后台 **系统设置 → 站点信息 → 服务器地址** 保持 `https://api.wingrid.tech`（不要末尾 `/`）。

***

## 常用环境变量速查

| 变量 | 主节点 | 从节点 | 说明 |
|------|--------|--------|------|
| `SQL_DSN` | 必填（共享） | 同主 | 同一可写库 |
| `REDIS_CONN_STRING` | 推荐 | 推荐同主 | 生产建议共享 |
| `SESSION_SECRET` | 必填 | **必须同主** | 禁止使用字面量 `random_string` |
| `CRYPTO_SECRET` | 共享 Redis 时必填 | **同主** | 缓存加解密 |
| `NODE_TYPE` | 省略或 `master` | **`slave`** | 从节点关键 |
| `NODE_NAME` | 建议 | 建议且唯一 | 审计/排障 |
| `SYNC_FREQUENCY` | 建议 `60` | 同主 | 缓存同步/陈旧窗口（秒） |
| `BATCH_UPDATE_ENABLED` | 建议 `true` | 建议 `true` | 降低额度写库压力 |
| `FRONTEND_BASE_URL` | 勿设（会被忽略） | 可选 | 从节点无前端时重定向到统一入口 |
| `STREAMING_TIMEOUT` | 按需 | 按需 | 流式无响应超时（秒） |

***

## 扩容与滚动更新

### 扩容从节点

1. 按「步骤二」部署新从节点
2. 在 Caddyfile 数据面 `reverse_proxy` 列表中追加 `新IP:3000`，并调整权重
3. `caddy validate` → `systemctl reload caddy`
4. 用 `/v1/models` 压测确认流量进入新节点

### 滚动更新

1. 先更新 **从节点**：`docker pull` → `compose up -d` → 健康检查通过
2. 再更新 **主节点**
3. Caddy 主动健康检查会在节点短暂不可用时摘除上游

***

## 运维建议

1. **定期备份数据库**（主从共用同一库，备份一份即可）
2. 监控各节点 CPU/内存、以及 Caddy 上游健康状态
3. 独立日志库可选：`LOG_SQL_DSN` 指向单独库，减轻主库压力
4. 防火墙：仅 Caddy / 内网可访问各节点 `3000`；勿把数据库/Redis 端口暴露公网
5. 安全组放行 Caddy 的 `80/443`，以及节点间到 DB/Redis 的内网访问

***

## 故障排除

| 现象 | 排查 |
|------|------|
| 登录态随机失效 | 各节点 `SESSION_SECRET` 是否完全一致；Cookie 域名/HTTPS 是否正确 |
| 额度/限流异常 | 是否未共享 Redis，或 `CRYPTO_SECRET` 不一致 |
| 从节点启动报迁移相关问题 | 确认 `NODE_TYPE=slave`；迁移只应由主执行 |
| 流式输出卡住/一次性吐出 | Caddy 是否设置 `flush_interval -1`；中间是否还有其它反向代理缓冲 |
| 某节点流量为 0 | Caddy 健康检查失败、IP/端口错误、权重为 0、安全组未放行 |
| WebSocket `/v1/realtime` 失败 | 确认 `Upgrade`/`Connection` 头透传；超时是否过短 |
| 证书申请失败 | 域名解析、80 端口可达、防火墙/CDN 是否拦截 ACME |

***

## 相关文档

- [宝塔面板部署](./BT.md)
- [官方集群部署](https://docs.newapi.ai/zh/docs/installation/deployment-methods/cluster-deployment)
- [环境变量](https://docs.newapi.ai/zh/docs/installation/config-maintenance/environment-variables)
- [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)



## 快速启动命令

```bash
cd deploy/master-slave
cp .env.example .env   # 填 SQL_DSN / REDIS_* / SESSION_SECRET / CRYPTO_SECRET

./build.sh
./start-master.sh                    # 主
./start-slave.sh new-api-slave-1     # 从（另机；REDIS 指主节点）

curl -sS http://127.0.0.1:3888/api/status
```