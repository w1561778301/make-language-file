const fs = require('fs');
const path = require('path');
const util = require('util');
const xlsx = require('node-xlsx');
const glob = require('glob')

const sheets = xlsx.parse('./file/languages-mall.xlsx');
// const sheets = xlsx.parse('./file/languages-backend.xlsx');

const untranslated = new Set()
/**
 * sheets是一个数组，数组中的每一项对应 langes.xlsx 这个文件里的多个表格
 * 如sheets[0]对应 Sheet1 这个表格
 * sheets[1]对应 Sheet2 这个表格
 */
const sheet = sheets[0]; // 我们这里只取第一个表
const filePath = './lang' // 多语言生成后会存放在此目录下
const templatePath = path.resolve(__dirname, './template')
const col = sheet['data'][0] // 表格中的第一行，用来获取多语言名称以生成对应的 js 文件
const zhCNs = sheet['data'].map(key => key[1])
// const zhFile = require('./file/cn.js')
for (let j = 2; j < col.length; j++) {
	glob('**/*.*', { cwd: templatePath, nodir: false }, (err, files) => {
		if (err) {
			console.log(err)
		} else {
			const language = col[j].split('&')[1]  // 获取语言
			files.forEach((file) => {
				const zhCNFilePath = templatePath + '/' + file  // 中文文件
				const zhCNDir = file.substring(0, file.lastIndexOf('/')) // 获取中文js文件路径
				const zhCNFileName = file.substring(file.lastIndexOf('/') + 1, file.lastIndexOf('.js'))  // 获取中文js文件名
				let filename
				let languagePath
				if (!zhCNDir) {  // 如果不存在子目录，则文件名就为语言标识， 存在子目录用语言标识做上层目录
					filename = language
					languagePath = filePath
				} else {
					filename = zhCNFileName
					languagePath = `${filePath}/${language}/${zhCNDir}`
				}

				fs.readFile(zhCNFilePath, 'utf-8', (error, data) => {
					if (error) {
						console.log(error)
					} else {
						data = data.replace('export default', 'module.exports =')  // 因为是用require引用 所以要把export default 替换成 module.exports =
						fs.writeFileSync(zhCNFilePath, data, 'utf-8')
						const zhFile = require(zhCNFilePath)
						const languageData = deepSearch(zhFile, j)
						const xlsxData = Array.from(untranslated).map(d => [d])
						// 存在未翻译的内容存放在untranslated.xlsx内(内容已经自动去重)
						const newSheets = [{
							name: 'sheet1',
							data: xlsxData
						}]
						let buffer = xlsx.build(newSheets)
						fs.writeFileSync('./file/untranslated.xlsx', buffer)
						createFile(languagePath, filename, languageData)

					}
				})
			})
		}
	})
}

/**
 * 深度遍历生成对应的多语言数据
 * @param {*} templateObj
 * @param {*} j
 * @returns
 */
function deepSearch(templateObj, j) {
	try {
		let obj = {}
		for (const key in templateObj) {
			if (typeof templateObj[key] === 'object') {
				obj[key] = deepSearch(templateObj[key], j)
			} else {
				const index = zhCNs.findIndex(zh => {
					if (zh && templateObj[key]) {
						return zh.trim() == templateObj[key].trim()
					} else {
						return false
					}
				})
				if (index > -1) {
					obj[key] = sheet['data'][index][j]
				} else {
					obj[key] = templateObj[key]
					untranslated.add(templateObj[key]) // 记录没有翻译的中文内容
				}
			}
		}
		return obj
	} catch (e) { }

}


/**
* 将数据写入文件
* @param {string} 要写入的内容
* @param {string} 要保存的文件名
*/
async function createFile(dirPath, filename, con) {
	const str = 'export default '
	// con 中的内容如果不处理的话写入文件后会显示成 [object Object]
	const data = util.inspect(con, { showHidden: false, depth: null })
	mkdir(dirPath, () => {
		const file = path.join(dirPath, filename + '.js')
		fs.writeFile(file, str + data, (err) => {
			if (err) throw err;
			console.log(filename + ' 保存成功！');
		});
	})
}

/**
 * 创建文件夹
 * @param {string} dir 要创建的文件夹路径
 */
function mkdir(pathStr, cb) {
	let pathList = pathStr.split("/");
	// 递归调用fs.mkdir
	let index = 1;
	function make(err) {
		if (err) return cb(err);
		if (index === pathList.length + 1) return cb();
		//每次 调用要将上次的已经生成的文件名做下次的目标文件，
		// 所以 slice(0, index) 第二参数也要 累加
		//slice(0, index) 截取后join('/')  成字符串
		let currentPath = pathList.slice(0, index++).join("/");
		// console.log("pathList.slice(0,index)", pathList.slice(0, index));
		fs.stat(currentPath, function (err) {
			if (err) {
				fs.mkdir(currentPath, make);
				console.log({ currentPath });
				// 如果不存在，再创建  fs.mkdir(currentPath, make);
			} else {
				make();
			}
		});
	}
	make();
}

