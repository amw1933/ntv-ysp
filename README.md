# nTv YSP

一个独立的央视频直播与七天回看网关。项目提供：

- 64 路频道目录
- 直播播放
- 53 路七天回看
- 浏览器播放器
- 电视节目单点播
- M3U 订阅输出
- Docker 部署

项目不包含第三方 v9.5 发布包，也不在原项目目录内运行。协议、播放列表重写和本地切片代理都在本仓库独立实现。

## 快速开始

需要 Node.js 20 或更高版本。

```bash
npm start
```

打开：

```text
http://localhost:8768
```

供电视播放器使用的订阅地址：

```text
http://你的局域网IP:8768/all.m3u
```

例如当前这台电脑是：

```text
http://10.10.10.108:8768/all.m3u
```

健康检查：

```text
http://localhost:8768/health
```

Docker：

```bash
docker compose up -d --build
```

## 播放器操作

- 默认打开上次播放的频道。
- 左侧搜索频道，点击频道切台。
- “直播”返回当前直播窗口。
- “节目单”选择日期和节目，点已播节目直接回看。
- 也可以选择时间点和分钟数后点“回看”。
- 浏览器自动播放策略可能先静音，点一下画面或“开声音”即可。

## Android TV 播放器

推荐让电视播放器直接读取网关，不依赖手机投屏。网关需要运行在电视可以访问的电脑或 NAS 上。

已验证：

- Televizo：支持 M3U、节目单、直播和存档/回看页签。
- TiviMate：支持 M3U 和 catch-up，但官方渠道是 Google Play/Amazon，项目不提供第三方镜像 APK。

Televizo 添加方式：

1. 选择“创建播放列表”。
2. 选择“新的 M3U 播放列表”。
3. 名称填写 `nTv YSP`。
4. 链接填写 `http://你的局域网IP:8768/all.m3u`。
5. 保存后等待频道和节目单载入。

## 开源 TVBox

Takagen Box 这类旧版 TVBox 使用单直播源配置：

```text
http://你的局域网IP:8768/tvbox.json
http://你的局域网IP:8768/tvbox-v95.json
```

`tvbox.json` 使用自建源，`tvbox-v95.json` 使用原版 v9.5。修改 TVBox 的配置地址即可切换。

新版 FongMi/TV 可以使用双源配置：

```text
http://你的局域网IP:8768/tvbox-all.json
```

该配置会包含：

- `nTv 自建 1080P`：`http://你的局域网IP:8768/all.m3u`
- `原版 v9.5`：`http://你的局域网IP:8767/all.m3u`

如果原版 v9.5 不在同一台机器的 `8767` 端口，可以设置：

```powershell
$env:V95_M3U_URL = 'http://其他地址:8767/all.m3u'
npm start
```

已验证可用的 GitHub 开源 TVBox：

- [takagen99/Box](https://github.com/takagen99/Box)：AGPL-3.0，GitHub Release 提供 APK，当前安装包为 `v1.0.0-alpha`。
- [FongMi/TV](https://github.com/FongMi/TV)：GPL-3.0，维护更活跃，但仓库没有直接附 APK，需要自行构建。

单个频道也可以直接播放，例如：

```text
http://你的局域网IP:8768/cctv5.m3u8
```

只允许在局域网使用。当前网关没有公网鉴权，不要直接暴露到互联网。

## 当前范围

第一版专注视频链路：

- 1080p 直播
- CCTV-5 等频道的七天时移回看
- autoEPG 电视节目单
- 本地切片代理与短时播放列表缓存
- 频道数据接口

暂未包含：

- 真正 4K 专用伴生引擎，当前直连备用线路最高为 1080p
- 部分频道暂不提供回看
- HarmonyOS HAP

APK 和 HAP 会在后续接入同一套协议接口，不再依赖本机 Python 或 Docker。

## 接口

| 路径 | 用途 |
| --- | --- |
| `/` | 网页播放器 |
| `/all.m3u` | 播放器订阅 |
| `/{channel}.m3u8` | 直播 |
| `/{channel}.m3u8?playseek=开始-结束` | 回看 |
| `/api/channels` | 频道数据 |
| `/api/epg/{channel}?date=YYYY-MM-DD` | 频道节目单 |
| `/health` | 运行状态 |

回看时间格式为 `yyyyMMddHHmmss`，例如：

```text
/cctv5.m3u8?playseek=20261021100000-20261021103000
```

## 说明

本项目用于播放你所在地区有权访问的公开直播内容，不绕过付费、登录或地域限制。频道、清晰度和回看能力由上游服务决定，接口变化可能导致部分功能失效。

请勿把本项目描述为央视频官方客户端。公开发布和二次分发前，请自行确认上游服务条款及当地法律要求。

## License

MIT
