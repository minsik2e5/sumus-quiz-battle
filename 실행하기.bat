@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js가 없습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.& pause & exit /b)
if not exist node_modules (echo 처음 실행: 필요한 파일 설치 중... & call npm install --omit=dev)
start "" http://localhost:3000/host
node server.js
pause
