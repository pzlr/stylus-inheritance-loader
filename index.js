'use strict';

const
	Sugar = require('sugar'),
	escaper = require('escaper');

const
	paramsStartReg = /^\s*\$p\s*=\s*(?=\{)/m,
	defineReg = /^([bigp]-[a-z0-9][a-z0-9-]*)(?:\s+extends\s+([bigp]-[a-z0-9][a-z0-9-]*))?$/m;

function collectBlock(str) {
	str = escaper.replace(str);

	let res = '{';

	let balance = 1;

	for (let i = 1; (i < str.length) && balance; ++i) {
		const char = str[i];

		if (char === '{') {
			++balance;

		} else if (char === '}') {
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
 *
 * @param {string} source
 * @return {string}
 */
function expandDefine(source) {
	const
		define = defineReg.exec(source);

	if (!define) {
		return source;
	}

	const [defineString, block, parent] = define;

	let paramsBlock;

	const paramsStartSearch = paramsStartReg.exec(source);

	if (paramsStartSearch) {
		const [start] = paramsStartSearch;

		paramsBlock = collectBlock(source.substr(paramsStartSearch.index + start.length));
		source = source.replace(start + paramsBlock, '');

	} else {
		paramsBlock = '{}';
	}

	let fullDefineString;

	const
		camelBlock = Sugar.String.camelize(block, false),
		camelParent = Sugar.String.camelize(parent || '', false);

	fullDefineString = `
$${camelBlock} = ()
declare($${camelBlock}, ${block})

$${camelBlock}Params = ${
	parent ? `fork($${camelParent}Params, ${paramsBlock})` : paramsBlock
}

@import "${block}_*.styl"

${block}($p)
	$p = fork($${camelBlock}Params, $p)

	${ parent ? `extends($${camelParent}, $p)` : ''}
`;

	fullDefineString = fullDefineString
		.split('\n')
		.filter((s) => !Sugar.String.isBlank(s))
		.join('\n');

	return source
		.replace(defineString, fullDefineString);
}

module.exports = (source, file) => {
	if (!/\.styl$/.test(file)) {
		return text;
	}

	if (/\.interface.styl$/.test(file)) {
		while (defineReg.test(source)) {
			source = expandDefine(source);
		}
	}

	return source.replace(
		/@import\s+"((?:\.{1,2}\/|[igbp]-[a-z0-9][a-z0-9-]*)[^"]*)"/gm,
		(str, path) => `//#include ${path}`
	);
};
