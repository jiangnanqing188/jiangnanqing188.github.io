const fs = require('fs');
const path = require('path');

console.log("🔍 开始检测安知鱼主题【关于页】配置问题...\n");

const paths = {
    indexMd: path.join(__dirname, 'source/about/index.md'),
    dataDir: path.join(__dirname, 'source/_data'),
    aboutYml: path.join(__dirname, 'source/_data/about.yml'),
    anzhiyuYml: path.join(__dirname, 'source/_data/anzhiyu.yml')
};

// 1. 检测 index.md
if (fs.existsSync(paths.indexMd)) {
    const content = fs.readFileSync(paths.indexMd, 'utf8');
    console.log("✅ 找到 source/about/index.md");
    if (!content.includes('layout: about')) console.log("❌ 错误：index.md 缺少 'layout: about'");
    if (!content.includes('type: "about"')) console.log("⚠️ 警告：index.md 建议添加 'type: \"about\"'");
} else {
    console.log("❌ 致命错误：未找到 source/about/index.md 文件！请检查路径是否正确。");
}

// 2. 检测数据文件
console.log("\n--- 数据文件检测 ---");
let dataFound = false;
if (fs.existsSync(paths.aboutYml)) {
    console.log("✅ 找到 source/_data/about.yml");
    dataFound = true;
} 
if (fs.existsSync(paths.anzhiyuYml)) {
    console.log("✅ 找到 source/_data/anzhiyu.yml (部分版本使用此文件名)");
    dataFound = true;
}

if (!dataFound) {
    console.log("❌ 致命错误：在 source/_data/ 目录下未找到 about.yml 或 anzhiyu.yml");
    if (!fs.existsSync(paths.dataDir)) console.log("💡 提示：连 _data 文件夹都没找到，请手动创建 source/_data/");
}

// 3. 检测内容格式
if (dataFound) {
    const dataPath = fs.existsSync(paths.aboutYml) ? paths.aboutYml : paths.anzhiyuYml;
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    if (!dataContent.includes('class_name:')) console.log("❌ 错误：数据文件内容格式似乎不对，缺少 'class_name' 关键字。");
    if (dataContent.includes('  - desc:')) console.log("✅ 数据项格式看起来基本正确。");
}

console.log("\n🚀 检测完成。请根据提示修复错误。");
console.log("修复后运行: hexo clean && hexo g && hexo s");