import { app, BrowserWindow } from 'electron';
import { join } from 'path';

console.log('Starting Electron application...');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  });

  // 在开发模式下连接到Vite服务器
  if (process.env.NODE_ENV === 'development') {
    console.log('Loading development URL...');
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Failed to load development URL:', err);
      // 如果无法连接到开发服务器，加载静态页面
      const rendererPath = join(__dirname, '../renderer/index.html');
      console.log('Trying to load local file:', rendererPath);
      mainWindow!.loadFile(rendererPath).catch(err2 => {
        console.error('Failed to load local file:', err2);
        // 加载一个简单的内置页面
        mainWindow!.loadURL('data:text/html,<h1>Web3 Client</h1><p>应用已启动，但无法加载用户界面</p>');
      });
    });
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Loading production file...');
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('Main window created successfully');
}

app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Electron application script loaded');