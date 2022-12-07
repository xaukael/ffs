/**  
 * @param {string} macroId the id of the macro where the sheet configuration will be stored in the ffs.config flag. This parameter should always be this.id
 * @param {string} name  all text on the sheet will be stored under in the actor's ffs.name flag
 * 
 * Example Macro command: character.freeformSheet(this.id, 'test');
*/
Actor.prototype.freeformSheet = async function(macroId, name) {
	let character = this;
	name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
	if (name == "config") return console.error("restricted name", name);
	let macro = null;
	macro = game.macros.get(macroId);
	if (!macro) return console.error("macro not found. first parameter should be this.id");
	
	let id = `ffs-${name}-${character.id}`;
	
	if ($(`div#${id}`).length) 
		return ui.windows[$(`div#${id}`).data().appid].render(true).bringToTop();
	
	if (!macro.flags.ffs?.config)
		await macro.setFlag('ffs', 'config', {});
	
	if (!macro.flags.ffs?.config?.background) 
		return new FilePicker({
			type: "image",
			displayMode: 'tiles',
			callback: async (path) => {
				await macro.setFlag('ffs', 'config.background', path);
				macro.execute();
				}
			}).browse();

	if (!character.flags.ffs?.[`${name}`]) 
    await character.setFlag('ffs', [`${name}`], {})
	if (!character.flags.ffs?.config)
		await character.setFlag('ffs', 'config', {scale: 1, color: "#000000", invert: false, filter: ''});
	
	ffs[id] = {};
	ffs[id] = {...ffs[id], ...character.flags.ffs.config};
	ffs[id] = {...ffs[id], ...macro.flags.ffs.config};

	let options = {width: 'auto', height: 'auto', id}
	if (ffs[id].width && ffs[id].height)
		options = {...options,...{width: ffs[id].width*ffs[id].scale+16, height: ffs[id].height*ffs[id].scale+46}};
		if (!ffs[id].left) {
		let i = await loadTexture(ffs[id].background);
		options = {...options,...{width: i.orig.width*ffs[id].scale+16, height: i.orig.height*ffs[id].scale+46}}
	}
	
	let newSpan = async function(key, value){
		let $span = $(`<span id="${key}">${TextEditor.enrichHTML(Roll.replaceFormulaData(value.text, {...character.toObject(), ...character.getRollData()}))}
		<span>`);
		$span.css({position:'absolute', left: value.x+'px', top: value.y+'px', color: 'black', fontSize: value.fontSize, cursor: 'grab'})
		let click = {x: 0, y: 0};
		$span
		.contextmenu(async function(e){
			e.stopPropagation();
			e.preventDefault();
			let value = character.flags.ffs[name][key];
			let $input = $(`<input type="text" value="${value.text}" size=${value.text.length} style="height:${$(this).css('height')}; width: ${$(this).parent().parent().width()}px; font-size: ${value.fontSize} ">`)
			.on('focusout keydown', async function(e){
				e.stopPropagation();
				if (e.keyCode != 13 && e.type == 'keydown') return;
				if ($(this).val().trim()=="" || $(this).val() == "NEW TEXT") {
					await character.unsetFlag('ffs', `${name}.${key}`);
					return $(this).parent().remove();
				}
				$(this).parent().html(TextEditor.enrichHTML(Roll.replaceFormulaData($(this).val(), {...character.toObject(), ...character.getRollData()})))
				await character.setFlag('ffs', [`${name}.${key}`], {text: $(this).val().trim()});
				$(this).remove();
			})
			.click(function(e){e.stopPropagation();});
			$(this).text('');
			$(this).append($input);
			$input.select();
		})
		.bind("wheel", async function(e) {
			let delta = e.originalEvent.wheelDelta>0?-1:1;
			let fontSize = Math.max(character.flags.ffs[name][key].fontSize+delta*2, 2)
			let top = (character.flags.ffs[name][key].y+delta*-1)
			$(this).css({fontSize: fontSize +"px", top: top+'px'})
			await character.setFlag('ffs', [`${name}.${key}`], {fontSize: fontSize, y: top});
		})
		.draggable({
			start: async function( event, data ) {
				$(this).css({cursor:'grabbing'});
				click.x = event.clientX;
				click.y = event.clientY;
			},
			stop: async function( event, data ) {
				await character.setFlag('ffs', [`${name}.${key}`], {x: data.position.left, y: data.position.top});
				$(this).css({cursor:'grab'})
			},
			drag: function(event, data) {
				let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0])
				let original = data.originalPosition;
				data.position = {
				  left: (event.clientX-click.x+original.left)/scale,
					top:  (event.clientY-click.y+original.top )/scale
				};
			}
		})
		return $span;
	}

	let d = new Dialog({
		title: `${character.name}`,
		content: `<div class="ffs" style="position: relative; cursor: text;"></div>`,
		buttons: {},
		render: async (html)=>{
			//console.log(`${id} render`)
			let {width, height, left, top, background, color , scale , fontFamily, fontWeight, invert, filter} = ffs[id];

			// apply configs
			html.css({height: 'max-content !important'});
			let $sheet = html.find('div.ffs');
			$sheet.before($(`<style>
			#${id} > section.window-content > div.dialog-content > div.ffs {font-family: ${fontFamily}; font-weight: ${fontWeight}}
        #${id} > section.window-content > div.dialog-content > div.ffs * {border: unset !important; padding: 0; background: unset; background-color: unset; color: ${color} !important;} 
        #${id} > section.window-content > div.dialog-content > div.ffs > span > input:focus {box-shadow: unset; } 
				#${id} > section.window-content > div.dialog-content > div.ffs > span { white-space: nowrap; }
				#${id} > section.window-content , #${id} > section.window-content > div.dialog-content > div.ffs {overflow:hidden;}
			</style>`));
			// remove dialog background
			html.parent().css({background:'unset'});

			// perform setup if macro config values come back undefined
			if (left==undefined) {
				let $img = $(`<img src="${background}" style="position: relative; cursor: crosshair">`)
				.click(async function(e){
          left = e.offsetX;
          top = e.offsetY;
					ffs[id].left = left;
					ffs[id].top = top;
					await macro.setFlag('ffs', 'config', {left, top}); 
					d.render(true);
				})
        $sheet.append($img);
				$sheet.parent().parent().parent().find('h4').text('Click the top left corner where the top left should be.');
				return;
			}
			if (width==undefined) {
				let $img = $(`<img src="${background}" style="position: relative; left: -${left}px; top: -${top}px; cursor: crosshair">`)
				.click(async function(e){
					width = e.offsetX-left;
					height = e.offsetY-top;
					ffs[id].width = width;
					ffs[id].height = height;
					await macro.setFlag('ffs', 'config', {width, height}); 
					d.close();
					Dialog.prompt({title: "Sheet Setup Complete", callback: ()=>{macro.execute()}});
				})
				$sheet.append($img)
				$sheet.parent().parent().parent().find('h4').text('Click the bottom right corner where the bottom right should be.')
				return ;
			}

			// apply config styles
			$sheet.css({
				'transform-origin': 'top left',
				'transform': `scale(${scale})`,
				'filter': filter,
				'background-image': `url(${background})`,
				'background-repeat' : 'no-repeat',
				'background-position': `top -${top}px left -${left}px`,
				'height': `${height}px`,'width': `${width}px`
			});

			// make spans
			for (const [key, value] of Object.entries(character.flags.ffs[name])) 
				$sheet.append(await newSpan(key, value));
			
			// apply sheet events for creating new spans
			$sheet.click(async function(e){
				if (e.originalEvent.target.nodeName != "DIV") return;
				let id = randomID();
				let value = {x: e.offsetX, y: e.offsetY-8, text: "NEW TEXT", fontSize: 16};
				await character.setFlag('ffs', [`${name}`], {[`${id}`]: value});
				let $span = await newSpan(id, value);
				$(this).append($span);
				$span.contextmenu();
				
			})
			.bind('drop', async function(e){
				e.originalEvent.preventDefault();
				let data = JSON.parse(e.originalEvent.dataTransfer.getData("Text"));
				let id = randomID();
				let value = {x: e.offsetX, y: e.offsetY-8, text: fromUuidSync(data.uuid).link, fontSize: 16};
				await character.setFlag('ffs', [`${name}`], {[`${id}`]: value});
				let $span = await newSpan(id, value);
				$(this).append($span);
			});
		},
		close: async (html)=>{
				if (ffs[id].hook) Hooks.off('', ffs[id].hook);
				delete ffs[id];
				//delete character.apps[d.appId];
				return;
			}
	}, options
	).render(true);

	let waitRender = 100;
	// wait for the element
	if (!d._element) 
		while (!d._element  && waitRender-- > 0) await new Promise((r) => setTimeout(r, 50));
	// set header buttons
	let $header  = d._element.find('header');
	$header.find('h4.window-title').after($(`<a><i class="fas fa-cog"></i></a>`).click(function(e){
		new Dialog({
			title: `Font Configuration`,
			content: `
			${[...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%">`) + `</select>`}
			${[...Array(10)].map((x,i)=>(i+1)*100).reduce((a,w)=>a+=`<option value="${w}" style="font-weight: ${w};">${w}</option>`,`<select class="fontWeight" style="width:100%">`)+`</select>`}
			<input class="fontColor" type="color" value="" style="border:unset; padding: 0; width: 100%">
			`,
			buttons: {},
			render: (html)=>{ 
				html.parent().css({'color': 'white', 'filter': `${ffs[id].invert?'invert(90%)':'unset'}`});
				let $fontFamily = html.find('.fontFamily');
				let $fontWeight = html.find('.fontWeight');
				let $fontColor = html.find('.fontColor');
				$fontFamily.val(ffs[id].fontFamily);
				$fontWeight.val(ffs[id].fontWeight);
				$fontColor.val(ffs[id].color);
				
				$fontFamily.css('font-weight', $fontWeight.val());
				$fontFamily.css('font-family', $fontFamily.val());
				$fontWeight.css('font-weight', $fontWeight.val());
				$fontWeight.css('font-family', $fontFamily.val());
				$fontColor.prevAll().css({'color': ffs[id].color})

				$fontFamily.change(async function(){
					let fontFamily =  $(this).val();
					ffs[id].fontFamily = fontFamily;
					$(this).css({fontFamily});
					$(this).next().css({fontFamily});
					await character.setFlag('ffs', 'config', {fontFamily});
					d.render(true);
				});
				
				$fontWeight.change(async function(){
					let fontWeight = $(this).val();
					ffs[id].fontWeight = fontWeight;
					$(this).css({fontWeight});
					$(this).prev().css({fontWeight});
					await character.setFlag('ffs', 'config', {fontWeight});
					d.render(true);
				});

				$fontColor.change(async function(){
					let color = $(this).val();
					ffs[id].color = color;
					$(this).prevAll().css({color});
					await character.setFlag('ffs', 'config', {color})
					d.render(true);
				});
			},
			close:(html)=>{ return }
		},{...$(this).offset(), width: 150}).render(true);
	}));

	$header.find('h4.window-title').after($(`<a><i class="fa-solid fa-circle-question"></i></a>`).click(function(e){
		new Dialog({
			title: `Freeform Sheet Help`,
			content: `<center>
			<p>Click somewhere with the text cursor to spawn a NEW TEXT.</p>
			<p> Changes to the text will be saved on focus loss or pressing Enter. If there is no text entered or the value is still "NEW TEXT" the element will be removed.</p>
			<p>Click and drag saved text elements to reposition</p>
			<p>When hovering an element, the scroll wheel can be used to adjust the size of the text.</p>
			<p>Entities can be dragged from the sidebar. Macros can be dragged from the hotbar or macro directory. These will create clickable links to content on the sheet.</p>
			<p>The cog wheel in the header will show the font config. More fonts may be added in Foundry's core settings under <b>Additional Fonts</b>.</p>
			</center>`,
			buttons: {},
			render: (html)=>{ 
			},
			close:(html)=>{ return }
		},{width: 550}).render(true);
	}));
	
	$header.find('h4.window-title').after($(`<a title="Zoom In" ><i class="fas fa-plus"></i></a>`).click( async function(e){
		e.stopPropagation();
		let {scale, width, height} = ffs[id];
		scale += .1;
		scale = Math.round(scale*10)/10;
		ffs[id].scale = scale;
		$header.find('a.zoom > b').text(Math.round(scale*100)+'%')
		await character.setFlag('ffs', 'config.scale', scale);
		d.render(true, { width: width*scale+16, height: height*scale+46});
	}));

	$header.find('h4.window-title').after($(`<a class="zoom" title="Reset Scale"><b>${Math.round(ffs[id].scale*100)}%</b></a>`).click( async function(e) {
		let {scale, width, height} = ffs[id];
		scale = 1;
		ffs[id].scale = 1;
		$header.find('a.zoom > b').text(Math.round(scale*100)+'%')
		await character.setFlag('ffs', 'config.scale', scale);
		d.render(true, { width: width+16, height: height+46});
	}));

	$header.find('h4.window-title').after($(`<a title="Zoom Out" ><i class="fas fa-minus"></i></a>`).click( async function(e){
		e.stopPropagation();
		let {scale, width, height} = ffs[id];
		scale -= .1;
		scale = Math.round(scale*10)/10;
		ffs[id].scale = scale;
		$header.find('a.zoom > b').text(Math.round(scale*100)+'%')
		await character.setFlag('ffs', 'config.scale', scale);
		d.render(true, { width: width*scale+16, height: height*scale+46});
	}));
/*
	$header.find('h4.window-title').after($(`<a title="Toggle Invert" ><i class="fa-${ffs[id].invert?'regular':'solid'} fa-eye"></i></a>`).click( async function(e){
		e.stopPropagation();
		ffs[id].invert = !ffs[id].invert;
		d.element.find('div.ffs').css({filter: `${ffs[id].invert?'invert(90%)':'unset'}`});
		$(this).find('i').removeClass('fa-solid').removeClass('fa-regular');
		$(this).find('i').addClass(`${ffs[id].invert?'fa-regular':'fa-solid'}`);
		await character.setFlag('ffs', 'config', {invert: ffs[id].invert});
	}));
*/
	$header.find('h4.window-title').after($(`<a title="Toggle Invert" ><i class="fa-solid fa-eye"></i></a>`).click( async function(e){
		e.stopPropagation();
		let confirm = false;
		let values = game.user.character.flags.ffs.config.filter.split('%').map(f=>f.split('(')).map((f,i)=>!i?f:[f[0].split(' ')[1], f[1]]).reduce((a,f)=>{ return {...a, [`${f[0]}`]: f[1]}; },{})
		new Dialog({
			title: `Filter Configuration`,
			content: `<center>
			 grayscale<input type="range" min="0" max="100" value="${values.grayscale}" class="grayscale" data-filter="grayscale">
			 sepia <input type="range" min="0" max="100" value="${values.sepia}" class="sepia" data-filter="sepia">
			 invert<input type="range" min="0" max="100" value="${values.invert}" class="invert" data-filter="invert">
			 saturate<input type="range" min="0" max="200" value="${values.saturate}" class="saturate" data-filter="saturate">
			 contrast<input type="range" min="0" max="200" value="${values.contrast}" class="contrast" data-filter="contrast">
			 brightness<input type="range" min="0" max="200" value="${values.brightness}" class="brightness" data-filter="brightness">
			</center>`,
			buttons: {
				confrim: {label:"confirm", callback: async (html)=>{
					confirm = true;
					let filter = [...html.find('input[type=range]')].map(f=>f.dataset.filter+'('+f.value+'%)').join(' ');
					await character.setFlag('ffs', 'config.filter', filter);
					ffs[id].filter = filter;
				}},
				cancel: {label:"cancel", callback: async (html)=>{
				}}
			},
			render: (html)=>{ 
				html.find('input[type=range]').change(async function(){
					let filter = [...html.find('input[type=range]')].map(f=>f.dataset.filter+'('+f.value+'%)').join(' ');
					$(`#${id}`).find('.ffs').css({filter})
				})
			},
			close:(html)=>{ 
				if (confirm) return;
				if (character.flags.ffs.config.filter) 
						$(`#${id}`).find('.ffs').css({filter: character.flags.ffs.config.filter});
					else
						$(`#${id}`).find('.ffs').css({filter: 'unset'});
				return }
		}).render(true);
	}));

	// I do not use the document.apps because it causes renders on every flag change I do. This way, I can ignore reloads on all ffs updates
	// character.apps[d.appId] = d;
	if (!d) return;
	if (ffs[id].hook) Hooks.off('', ffs[id].hook)
	ffs[id].hook = 
		Hooks.on(`update${this.documentName}`, (doc, updates)=>{
			if (doc.id!=character.id) return;
			if (!d) return;
			if (foundry.utils.hasProperty(updates, "flags.ffs")) return true;
			d.render(true, {height: 'auto', width: 'auto'});
		})
}

var ffs = {};

ffs.resetMacroConfig = async function(macroId) {
  await game.macros.get(macroId).update({'flags.-=ffs':null})
}

ffs.resetActorSheet = async function(actorId, name) {
  await game.actors.get(actorId).unsetFlag('ffs', name)
}