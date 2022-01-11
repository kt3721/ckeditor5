// 单元格列宽调整
import { throttle } from 'lodash-es';

/*
* 需要设置当前列所有单元格宽度
* 仅设置当前单元格宽度，会导致
* 1. 当前单元格被删除时，该列宽度丢失
* 2. 当前单元格所在列 其他单元格调整宽度时，若宽度小于该列其他单元格宽度，则宽度调整不会生效（因为 table 中每列会以该列中单元格最大宽度作为列宽）
*
* 因此需要设置 当前单元格所在列所有单元格宽度
*
* 设置列宽交互
* 1. 拖动时实时设置列宽
* 	方案1：查找出该列所有单元格，遍历设置宽度（耗时较高，会出现卡顿，且行数与耗时正相关）
* 	方案2： 使用 col 设置列宽（需要在 table 下插入子元素 colgroup）
*   	1. 在 table 下插入子元素 colgroup，根据列数添加 col
* 		2. 增加列时，需要增加 col
* 		3. 单元格合并/拆分时，需要更新 col（比较复杂）
*
* 2. 拖动结束后设置列宽（本案例中使用此方案）
* 	需要 添加 辅助线，用于指示当前列调整后的位置
* */
function setCellWidth( editor, width ) {
	const tableCell = editor.model.document.selection.getFirstPosition().findAncestor( 'tableCell' );
	const table = tableCell.findAncestor( 'table' );
	const columns = tableCell.parent.getChildren();
	const columnIndex = [ ...columns ].indexOf( tableCell );

	width = `${ width }px`;

	[ ...table.getChildren() ].forEach( row => {
		const tableCell = row.getChild( columnIndex );

		editor.model.change( writer => {
			writer.setAttribute( 'width', width, tableCell );
		} );
	} );
}

export default function tableCellColumnWidthResize() {
	// 查找父级元素中指定元素
	function getParentElement( el, tagName ) {
		if ( el.parentElement ) {
			if ( el.parentElement.tagName === tagName ) {
				return el.parentElement;
			}

			return getParentElement( el.parentElement, tagName );
		}

		return null;
	}
	function getResizeBarElement( el ) {
		if ( el.nextElementSibling ) {
			if ( el.nextElementSibling.classList.contains( 'ck-table-resize-bar' ) ) {
				return el.nextElementSibling;
			}

			return getResizeBarElement( el.nextElementSibling );
		}

		return null;
	}

	const MIN_WIDTH = 28; // 单元格 最小宽度 - 默认应该是 2em，字体大小是 14px
	const { editor } = this;
	const viewDocument = editor.editing.view.document;

	let resizing = false; // resize 标志
	let cell; // 当前操作的单元格
	let cellRect; // 单元格 尺寸位置信息
	let startX; // 鼠标 上一次 x 坐标
	let tableX; // table x 坐标
	let resizeBarMinX; // resizeBar 最小 x 坐标
	let resizeBar; // resizeBar

	const updateResizeBarStyle = style => {
		if ( Object.prototype.hasOwnProperty.call( style, 'left' ) ) {
			// 限制最小宽度
			if ( style.left < resizeBarMinX ) {
				style.left = resizeBarMinX;
			}

			style.left += 'px';
		}

		Object.assign( resizeBar.style, style );
	};

	this.listenTo( viewDocument, 'mousedown', ( eventInfo, domEventData ) => {
		const { domTarget } = domEventData;
		if ( !domTarget.classList.contains( 'ck-table-resizer' ) ) {
			return;
		}

		// 禁用 单元格选中，避免冲突
		editor.plugins.get( 'TableMouse' ).isEnabled = false;

		resizing = true;
		startX = domEventData.domEvent.clientX;

		cell = getParentElement( domTarget, 'TD' );
		cellRect = cell.getBoundingClientRect();

		const table = getParentElement( cell, 'TABLE' );
		tableX = table.getBoundingClientRect().x;

		resizeBar = getResizeBarElement( table );
		resizeBarMinX = cellRect.x - tableX + MIN_WIDTH;

		updateResizeBarStyle( {
			display: 'block',
			left: cellRect.x - tableX + cellRect.width - 1
		} );
	} );

	const mousemove = ( eventInfo, domEventData ) => {
		if ( !resizing ) {
			return;
		}

		updateResizeBarStyle( {
			left: domEventData.domEvent.clientX - tableX
		} );
	};
	this.listenTo( viewDocument, 'mousemove', throttle( mousemove, 10 ) );

	const mouseStop = ( eventInfo, domEventData ) => {
		if ( !resizing ) {
			return;
		}

		resizing = false;

		updateResizeBarStyle( {
			display: 'none'
		} );

		// 计算新宽度
		const distance = domEventData.domEvent.clientX - startX;

		if ( distance !== 0 ) {
			let newWidth = cellRect.width + distance;
			newWidth = newWidth < MIN_WIDTH ? MIN_WIDTH : newWidth;

			setCellWidth( editor, newWidth );
		}

		// 取消 禁用 单元格选中
		editor.plugins.get( 'TableMouse' ).isEnabled = true;
	};
	this.listenTo( viewDocument, 'mouseup', mouseStop );
	this.listenTo( viewDocument, 'mouseleave', mouseStop );
}
