/**  
 * @param {string} macroId the id of the macro where the sheet configuration will be stored in the ffs.config flag. This parameter should always be this.id
 * @param {string} name  all text on the sheet will be stored under in the actor's ffs.name flag
 * 
 * Example Macro command: character.freeformSheet(this.id, 'test');
*/
Actor.prototype.freeformSheet = async function(macroId, name) {
	if (name == "config") return console.error("restricted name", name);
	let character = this;
	name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
	let macro = null;
	macro = game.macros.get(macroId);
	if (!macro) return console.error("no arguments");
	
	let id = `freeform-character-sheet-${name}-${character.id}`;
	
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


	if (!character.flags.ffs[`${name}`]) 
    await character.setFlag('ffs', [`${name}`], {})
	if (!character.flags.ffs?.config)
		await character.setFlag('ffs', 'config', {scale: 1, color: "#000000"});
	
	
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
				if ($(this).val().trim()=="") {
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
	let { color , scale , fontFamily, fontWeight} = await character.getFlag('ffs', 'config');
  let {width, height, left, top, background} = await macro.getFlag('ffs', 'config');
	let options = {width: 'auto', height: 'auto', id}
	if (!!width && !!height)
		options = {...options,...{width: width*scale+16, height: height*scale+46}};
   if (!left) {
    let i = await loadTexture(background);
    options = {...options,...{width: i.orig.width*scale+16, height: i.orig.height*scale+46}}
  }

	let d = new Dialog({
		title: `${character.name}`,
		content: `<div class="freeform-sheet" style="position: relative; cursor: text;"></div>`,
		buttons: {},
    //template: "modules/ffs/ffs.hbs",
		render: async (html)=>{
			//console.log(`${name} render`);
      scale = character.flags.ffs.config.scale;
      color = character.flags.ffs.config.color;
			html.parent().find('div.dialog-buttons').remove();
			html.parent().css({background:'unset'});
			html.css({height: 'max-content !important'});
			let $sheet = html.find('div.freeform-sheet');
			$sheet.before($(`<style>
        #${id} > section.window-content > div.dialog-content > div.freeform-sheet * 
        {border: unset !important; padding: 0; background: unset; background-color: unset; color: ${color} !important;} 
        #${id} > section.window-content > div.dialog-content > div.freeform-sheet > span > input:focus {box-shadow: unset; } 
				#${id} > section.window-content > div.dialog-content > div.freeform-sheet > span { white-space: nowrap; }
				#${id} > section.window-content , #${id} > section.window-content > div.dialog-content > div.freeform-sheet {overflow:hidden;}
			</style>`));
			if (fontFamily) $sheet.css('font-family', fontFamily)
			if (fontWeight) $sheet.css('font-weight', fontWeight)
			if (!left) {
				let $img = $(`<img src="${background}" style="position: relative; cursor: crosshair">`)
				.click(async function(e){
          left = e.offsetX;
          top = e.offsetY;
					await macro.setFlag('ffs', 'config', {left, top}); 
					d.render(true);
				})
        $sheet.append($img);
				$sheet.parent().parent().parent().find('h4').text('Click the top left corner where the top left should be.');
				return;
			}
			if (!width) {
				let $img = $(`<img src="${background}" style="position: relative; left: -${left}px; top: -${top}px; cursor: crosshair">`);
				$img.click(async function(e){
					width = e.offsetX-left;
					height = e.offsetY-top;
					await macro.setFlag('ffs', 'config', { width, height}); 
					d.close();
					Dialog.prompt({title: "Sheet Setup Complete", callback: ()=>{macro.execute()}});
				})
				$sheet.append($img)
				$sheet.parent().parent().parent().find('h4').text('Click the bottom right corner where the bottom right should be.')
				return ;
			}
			$sheet.css({
				'transform-origin': 'top left',
				'transform': `scale(${scale})`,
				'background-image': `url(${background})`,
				'background-repeat' : 'no-repeat',
				'background-position': `top -${top}px left -${left}px`,
				'height': `${height}px`,'width': `${width}px`
			})
			
			if (html.parent().prev().find('i.fa-cog').length) html.parent().prev().find('i.fa-cog').parent().remove();
			html.parent().prev().find('h4.window-title').after($(`<a><i class="fas fa-cog"></i></a>`).click(function(e){
				confirm = false;
				new Dialog({
					title: `Font Configuration`,
					content: `
					${[...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%">`) + `</select>`}
					${[...Array(10)].map((x,i)=>(i+1)*100).reduce((a,w)=>a+=`<option value="${w}" style="font-weight: ${w};">${w}</option>`,`<select class="fontWeight" style="width:100%">`)+`</select>`}
          <input class="fontColor" type="color" value="${color}" style="border:unset; padding: 0; width: 100%">
					`,
					buttons: {},
					render: (html)=>{ 
            //html.parent().css({'background-image': `url(${background})`});
						let $fontFamily = html.find('.fontFamily');
						$fontFamily.val(fontFamily);
						$fontFamily.css('font-family', $fontFamily.val());
						$fontFamily.change(async function(){
              fontFamily =  $(this).val()
							$(this).css({fontFamily})
							$(this).next().css({fontFamily})
              await character.setFlag('ffs', 'config', {fontFamily})
              d.render(true);
						});
						let $fontWeight = html.find('.fontWeight');
						$fontWeight.val(fontWeight);
						$fontWeight.css('font-weight', $fontWeight.val());
						$fontWeight.change(async function(){
							fontWeight = $(this).val()
              $(this).css({fontWeight})
							$(this).prev().css({fontWeight})
							await character.setFlag('ffs', 'config', {fontWeight})
              d.render(true);
						});
            let $fontColor = html.find('.fontColor');
            $fontColor.prevAll().css({color})
            $fontColor.change(async function(){
              color = $(this).val()
              $(this).prevAll().css({color})
              await character.setFlag('ffs', 'config', {color})
              d.render(true);
						});
					},
					close:(html)=>{ 
						if (!confirm) $sheet.css({fontFamily, fontWeight})
						return d.render(true); }
				},{...$(this).offset(), width: 100}).render(true);
			}));
				
			if (html.parent().prev().find('i.fa-plus').length) html.parent().prev().find('i.fa-plus').parent().remove();
			html.parent().prev().find('h4.window-title').after($(`<a title="Zoom In" ><i class="fas fa-plus"></i></a>`).click( async function(e){
				e.stopPropagation();
				scale += .1
				if (scale>1) $(this).prev().show();
				await character.setFlag('ffs', 'config.scale', scale);
				d.render(true, { width: width*scale+16, height: height*scale+46});
			}));
			if (html.parent().prev().find('i.fa-minus').length) html.parent().prev().find('i.fa-minus').parent().remove();
			html.parent().prev().find('h4.window-title').after($(`<a title="Zoom Out" ><i class="fas fa-minus"></i></a>`).click( async function(e){
				e.stopPropagation();
				scale -= .1
				await character.setFlag('ffs', 'config.scale', scale);
				d.render(true, { width: width*scale+16, height: height*scale+46});
			}));
			
			let toDelete = Object.entries(character.getFlag("ffs", `${name}`) ?? {}).reduce((acc, [a,{text}]) => {
				if (text.trim()=="" || text === "NEW TEXT") acc[`flags.ffs.${name}.-=${a}`] = null;
				return acc;
			}, {});
			await game.user.character.update(toDelete);
			
			for (const [key, value] of Object.entries(character.flags.ffs[name])) 
				$sheet.append(await newSpan(key, value));
			
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
				if (Hooks[`sheetHook${name}`]) Hooks.off('', Hooks[`sheetHook${name}`]);
				//delete character.apps[d.appId];
				return;
			}
	}
	).render(true, {...options, ...{scale:1, renderContext:"", renderData:{}}});
	
	// I do not use the document.apps because it causes renders on every flag change I do
	// character.apps[d.appId] = d;
	if (!d) return;
	if (Hooks[`sheetHook${id}`]) Hooks.off('', Hooks[`sheetHook${id}`])
	Hooks[`sheetHook${id}`] = 
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