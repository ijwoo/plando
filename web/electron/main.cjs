const { app, BrowserWindow, Tray, Menu, session, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const MIME = {
    ".html": "text/html",
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".css":  "text/css",
    ".json": "application/json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".woff": "font/woff",
    ".woff2":"font/woff2",
    ".ttf":  "font/ttf",
    ".webp": "image/webp",
};

let localServer = null;

function startLocalServer(distPath) {
    return new Promise((resolve) => {
        localServer = http.createServer((req, res) => {
            const urlPath = req.url.split("?")[0];
            let filePath = path.join(distPath, urlPath);

            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                filePath = path.join(distPath, "index.html");
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME[ext] || "application/octet-stream";

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }
                res.writeHead(200, { "Content-Type": contentType });
                res.end(data);
            });
        });

        localServer.listen(0, "127.0.0.1", () => {
            resolve(localServer.address().port);
        });
    });
}

app.setAppUserModelId("com.plando.app");

let mainWindow;
let tray;
let isQuiting = false;

function createWindow(localPort) {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        autoHideMenuBar: true,
        backgroundColor: "#0f172a",
        icon: path.join(__dirname, "../assets/icon.ico"),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            additionalArguments: ["--is-electron"],
        },
    });

    const isDev = !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL(`http://127.0.0.1:${localPort}`);
    }

    // target="_blank" 링크 → 시스템 기본 브라우저로 열기 (길찾기, 외부 링크 등)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    // 같은 창에서 외부 URL로 이동하려 할 때 처리
    mainWindow.webContents.on("will-navigate", (event, url) => {
        // OAuth 시작 URL → 반드시 프로덕션 서버로 새 창 처리
        // (localhost로 시작하면 redirect_uri가 localhost가 되어 KOE101 발생)
        if (url.includes("/oauth2/authorization/")) {
            event.preventDefault();
            const provider = url.split("/oauth2/authorization/")[1].split("?")[0];
            openOAuthWindow(`https://plando.imjaewoo.dev/oauth2/authorization/${provider}`);
            return;
        }

        const isLocal = url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
        if (isLocal) return; // 내부 라우팅은 허용

        event.preventDefault();

        const isOAuth = url.includes("kauth.kakao.com") || url.includes("accounts.google.com");
        if (isOAuth) {
            openOAuthWindow(url);
        } else {
            shell.openExternal(url);
        }
    });

    mainWindow.on("close", (event) => {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function openOAuthWindow(url) {
    const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    authWindow.loadURL(url);

    // 콜백 URL(plando.imjaewoo.dev/oauth2/callback?token=...) 감지
    authWindow.webContents.on("will-navigate", (event, callbackUrl) => {
        handleOAuthCallback(callbackUrl, authWindow);
    });
    authWindow.webContents.on("will-redirect", (event, callbackUrl) => {
        handleOAuthCallback(callbackUrl, authWindow);
    });
}

function handleOAuthCallback(callbackUrl, authWindow) {
    if (!callbackUrl.includes("/oauth2/callback")) return;

    const tokenMatch = callbackUrl.match(/[?&]token=([^&]+)/);
    if (tokenMatch && mainWindow) {
        const token = decodeURIComponent(tokenMatch[1]);
        // 토큰을 메인 창 localStorage에 저장하고 대시보드로 이동
        mainWindow.webContents.executeJavaScript(`
            localStorage.setItem('accessToken', ${JSON.stringify(token)});
            window.location.hash = '#/dashboard';
        `);
        mainWindow.show();
        mainWindow.focus();
    }
    authWindow.close();
}

function createTray() {
    try {
        tray = new Tray(path.join(__dirname, "../assets/icon.ico"));
    } catch (e) {
        console.error("Tray 생성 실패:", e);
        return;
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "열기",
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        {
            label: "숨기기",
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            },
        },
        { type: "separator" },
        {
            label: "종료",
            click: () => {
                isQuiting = true;
                app.quit();
            },
        },
    ]);

    tray.setToolTip("Plan Do!");
    tray.setContextMenu(contextMenu);

    tray.on("click", () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

app.whenReady().then(async () => {
    // 카카오 SDK 요청 시 Referer를 등록된 도메인으로 교체 (Electron 로컬 origin 401 방지)
    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ["*://dapi.kakao.com/*", "*://*.kakao.com/*"] },
        (details, callback) => {
            details.requestHeaders["Referer"] = "https://plando.imjaewoo.dev";
            details.requestHeaders["Origin"]  = "https://plando.imjaewoo.dev";
            callback({ requestHeaders: details.requestHeaders });
        }
    );

    if (!app.isPackaged) {
        createWindow();
    } else {
        const distPath = path.join(__dirname, "../dist");
        const port = await startLocalServer(distPath);
        createWindow(port);
    }
    createTray();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on("window-all-closed", () => {
    // tray 유지
});

app.on("before-quit", () => {
    if (localServer) localServer.close();
});