'use strict';

const
	Sugar = require('sugar'),
	escaper = require('escaper');

const
	paramsStartReg = /^\s*\$p\s*=\s*(?=\{)/m,
	defineReg = /^([bigp]-[a-z0-9][a-z0-9-_]*)(?:\s+extends\s+([bigp]-[a-z0-9][a-z0-9-_]*))?$/m,
	varsReg = /\$p\.[.\w$]+/g;

/**
 * Returns block parameters from a string
 *
 * @param str - source string
 * @returns {string}
 */
function getBlockParams(str) {
	str = escaper.replace(str);

	let res = '{\n\tselector: "&",\n';
	let balance = 1;

	for (let i = 1; (i < str.length) && balance; ++i) {
		const char = str[i];

		if (char === '{') {
			++balance;

		} else if (char === '}') {
			if (res[res.length - 1] === ',') {
				res = res.slice(0, -1);
			}

			--balance;
		}

		res += char;
	}

	if (balance) {
		throw new Error(`Can't extract params`);
	}

	return escaper.paste(res);
}

/**
 * Expands block declaration from a source text
 *
 * @param {string} source
 * @param {boolean=} [isMod]
 * @returns {string}
 */
function expandDefine(source, isMod) {
	const
		define = defineReg.exec(source);

	if (!define) {
		return source;
	}

	const
		[defineString, block, parent] = define,
		paramsStartSearch = paramsStartReg.exec(source);

	let paramsBlock;
	if (paramsStartSearch) {
		const [start] = paramsStartSearch;
		paramsBlock = getBlockParams(source.substr(paramsStartSearch.index + start.length));
		source = source.replace(start + paramsBlock, '');

	} else {
		paramsBlock = '{\n\tselector: "&"\n}';
	}

	const
		mod = isMod && block.replace(/[^_]+/, ''),
		modName = mod && mod.split('_')[1];

	if (isMod) {
		const tmp = `\n\t${modName}: ${block.replace(/[^_]+/, '')}`;
		paramsBlock = paramsBlock[0] + tmp + (paramsBlock.length > 2 ? ',' : '') + paramsBlock.slice(1);
	}

	const
		camelBlock = Sugar.String.camelize(block, false),
		camelParent = Sugar.String.camelize(parent || '', false);

	let fullDefineString = `
${!isMod ? `$${camelBlock} = ()` : ''}
declare($${isMod ? camelParent : camelBlock}, ${block})

$${camelBlock}Params = ${
	parent ? `fork($${camelParent}Params, ${paramsBlock})` : paramsBlock
}

${!isMod ? `@import "${block}_*.styl"` : ''}

${block}($p)
	$p = fork($${camelBlock}Params, $p)
	${parent && !isMod ? `extends($${camelParent}, $p)` : ''}
`;

	fullDefineString = fullDefineString
		.split(/\r?\n|\r/)
		.filter((s) => !Sugar.String.isBlank(s))
		.join('\n');

	source = source.replace(/_\//g, '{$p.selector}');

	if (isMod) {
		source = source.replace(new RegExp(`\\/(${modName})\\b`, 'g'), '{$p.selector}{$p.$1}');
	}

	const
		vars = {};

	source = source.replace(varsReg, (val) => vars[val] = val.replace(/\./g, '__'));
	Object.keys(vars).sort().forEach((key) => fullDefineString += `\n\t${vars[key]} = ${key}`);

	return source.replace(defineString, fullDefineString);
}

/**
 * @param {string} source
 * @param {string} file
 * @returns {string}
 */
module.exports = (source, file) => {
	if (!/\.styl$/.test(file)) {
		return source;
	}

	if (/(?:\.interface|(_[a-z0-9-]+_[a-z0-9-]+)).styl$/.test(file)) {
		const isMod = Boolean(RegExp.$1);
		while (defineReg.test(source)) {
			source = expandDefine(source, isMod);
		}
	}

	return source.replace(
		/@import\s+"((?:\.{1,2}\/|[igbp]-[a-z0-9][a-z0-9-]*)[^"]*)"/gm,
		(str, path) => `//#include ${path}`
	);
};
