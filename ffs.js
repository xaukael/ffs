/**  
 * @param {string} macroId the id of the macro where the sheet configuration will be stored in the ffs.config flag. This parameter should always be this.id
 * @param {string} name  all text on the sheet will be stored under in the actor's ffs.name flag
 * 
 * Example Macro command: character.freeformSheet(this.id, 'test');
*/
Actor.prototype.freeformSheet = async function(name) {
	let character = this;
	name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
	if (name == "config") return console.error("restricted name", name);
	//let macro = null;
	//macro = game.macros.get(macroId);
	//if (!macro) return console.error("macro not found. first parameter should be this.id");
	let sheet = game.settings.get('ffs', 'sheets')[name];
	if (!sheet) return console.error(`sheet config for ${name} not found in game settings`);;
	let id = `ffs-${name}-${character.id}`;
	
	if ($(`div#${id}`).length) 
		return ui.windows[$(`div#${id}`).data().appid].render(true).bringToTop();

	if (!character.flags.ffs?.[name]) 
    await character.setFlag('ffs', [name], {})
	if (!character.flags.ffs?.[name].config)
		await character.setFlag('ffs', [name], {config: {scale: 1, color: "#000000", filter: ''}});
	
	// perform cleanup of empty and NEW TEXT. Should not be necessary
	let toDelete = Object.entries(character.flags.ffs[name] ?? {}).reduce((acc, [a,{text}]) => {
		if (a == 'config') return acc;
		if (text.trim()=="" || text.trim() === "NEW TEXT") acc[`flags.ffs.${name}.-=${a}`] = null;
		return acc;
	}, {});
	await character.update(toDelete);

	ffs[id] = {...character.flags.ffs[name].config, ...sheet};

	let options = {width: 'auto', height: 'auto', id}
	if (ffs[id].width && ffs[id].height)
		options = {...options,...{width: ffs[id].width*ffs[id].scale+16, height: ffs[id].height*ffs[id].scale+46}};
		if (!ffs[id].left) {
		let i = await loadTexture(ffs[id].background);
		options = {...options,...{width: i.orig.width*ffs[id].scale+16, height: i.orig.height*ffs[id].scale+46}}
	}
	
	let newSpan = async function(key, value){
		let $span = $(`<span id="${key}" style="cursor: text;">
			${TextEditor.enrichHTML(Roll.replaceFormulaData(value.text, {...character.toObject(), ...character.getRollData()}))}
		<span>`);
		$span.css({position:'absolute', left: value.x+'px', top: value.y+'px', color: 'black', fontSize: value.fontSize})
		let click = {x: 0, y: 0};
		$span
		.focusout(async function(){
			$(this).find('span').remove();
			let input = $(this).html().trim();
			if (input == "" || input == "NEW TEXT") {
				console.log(`removing span`, name, key)
				await character.unsetFlag('ffs', `${name}.${key}`);
				return $(this).remove();
			}
			$(this).html(TextEditor.enrichHTML(Roll.replaceFormulaData(input, {...character.toObject(), ...character.getRollData()})))
			await character.setFlag('ffs', [`${name}.${key}`], {text: input});
			$(this).draggable('enable')
			$(this).prop('role',"")
			$(this).prop('contenteditable',"false")
		})
		.keydown(function(e){
			if (e.key != "Enter") return;
			return $(this).blur();
		})
		.focusin(function(){
			
			$(this).select()
			let selection = window.getSelection();
			let range = document.createRange();
			range.selectNodeContents(this);
			selection.removeAllRanges();
			selection.addRange(range);
			$(this).draggable('disable')
		})
		.bind("wheel", async function(e) {
			let delta = e.originalEvent.wheelDelta>0?-1:1;
			let fontSize = Math.max(character.flags.ffs[name][key].fontSize+delta*2, 2)
			let top = (character.flags.ffs[name][key].y+delta*-1)
			$(this).css({fontSize: fontSize +"px", top: top+'px'})
			await character.setFlag('ffs', [`${name}.${key}`], {fontSize: fontSize, y: top});
		})
		.draggable({
			start: function(e){
				//$(this).css('pointer-events', 'none')
				$(this).css('cursor', 'grabbing');
				click.x = e.clientX;
				click.y = e.clientY;
			},
			drag: function(e, data) {
				let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0])
				let original = data.originalPosition;
				data.position = {
				  left: (e.clientX-click.x+original.left)/scale,
					top:  (e.clientY-click.y+original.top )/scale
				};
				$(this).css('cursor', 'grabbing');
			},
			stop: async function(e, d){
				await character.setFlag('ffs', [`${name}.${key}`], {x: d.position.left, y: d.position.top});
				//$(this).css('pointer-events', 'all')
				$(this).css('cursor','text');
			}
		})
		.contextmenu(function(e){
			e.stopPropagation();
			e.preventDefault();
			let text = character.flags.ffs[name][key].text
			if (e.ctrlKey || text.includes('@UUID')) {
				new Dialog({
					title: key,
					content: `<input type="text" value="${text}"></input>`,
					buttons: {confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
						confirm = true;
						let input = html.find('input').val();
						if (input == "" || input == "NEW TEXT") {
							console.log(`removing span`, name, key)
							await character.unsetFlag('ffs', `${name}.${key}`);
							return $(this).remove();
						}
						$(this).html(TextEditor.enrichHTML(Roll.replaceFormulaData(input, {...character.toObject(), ...character.getRollData()})))
						await character.setFlag('ffs', [`${name}.${key}`], {text: input});
					}},
					cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
					default: 'confirm',
					close: ()=>{return}
				}).render(true)

				return;
			}
			$(this).html(text)
			$(this).prop('role',"textbox")
			$(this).prop('contenteditable',"true")
			$(this).focus()
		})
		return $span;
	}

	let d = new Dialog({
		title: `${character.name}`,
		content: `<div class="ffs"></div>`,
		buttons: {},
		render: async (html)=>{
			//console.log(`${id} render`)
			let {width, height, left, top, background, color , scale , fontFamily, fontWeight, filter} = ffs[id];

			// apply configs
			html.css({height: 'max-content !important'});
			let $sheet = html.find('div.ffs');

			$sheet.before($(`<style>
				#${id} > section.window-content > div.dialog-content > div.ffs {font-family: ${fontFamily}; font-weight: ${fontWeight}; cursor: cell; position: relative;}
        #${id} > section.window-content > div.dialog-content > div.ffs * {border: unset !important; padding: 0; background: unset; background-color: unset; color: ${color} !important;} 
        #${id} > section.window-content > div.dialog-content > div.ffs > span > input:focus {box-shadow: unset; } 
				#${id} > section.window-content > div.dialog-content > div.ffs > span:focus-visible {outline-color:white; outline:unset; /*outline-style: outset; outline-offset: 6px;*/}
				#${id} > section.window-content > div.dialog-content > div.ffs > span { white-space: nowrap;  position: absolute; }
				#${id} > section.window-content , #${id} > section.window-content > div.dialog-content > div.ffs {overflow:hidden;}
			</style>`));
			// remove dialog background
			html.parent().css({background:'unset'});

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
				if (key=='config') continue;
				else $sheet.append(await newSpan(key, value));
			
			// apply sheet events for creating new spans
			
			$sheet.contextmenu(async function(e){
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
				let text = fromUuidSync(data.uuid).link
				let id = randomID();
				let value = {x: e.offsetX, y: e.offsetY-8, text, fontSize: 16};
				await character.setFlag('ffs', [`${name}`], {[`${id}`]: value});
				let $span = await newSpan(id, value);
				$(this).append($span);
			});
		},
		close: async (html)=>{
				if (ffs[id].hook) Hooks.off('', ffs[id].hook);
				//delete ffs[id];
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
	if (game.user.isGM)
		$header.find('h4.window-title').after($(`<a><i class="fa-solid fa-cog"></i></a>`).click(async function(){
			ffs.configure(name)
		}));

	$header.find('h4.window-title').after($(`<a><i class="fa-solid fa-circle-question"></i></a>`).click(function(e){
		new Dialog({
			title: `Freeform Sheet Help`,
			content: `<center>
			<p>Click somewhere with the text cursor to spawn a NEW TEXT.</p>
			<p>Changes to the text will be saved on focus loss or pressing Enter. If there is no text entered or the value is still "NEW TEXT" the element will be removed.</p>
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

	$header.find('h4.window-title').after($(`<a><i class="fa-solid fa-font"></i></a>`).click(function(e){
		new Dialog({
			title: `Font Configuration`,
			content: `
			${[...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%">`) + `</select>`}
			${[...Array(10)].map((x,i)=>(i+1)*100).reduce((a,w)=>a+=`<option value="${w}" style="font-weight: ${w};">${w}</option>`,`<select class="fontWeight" style="width:100%">`)+`</select>`}
			<input class="fontColor" type="color" value="" style="border:unset; padding: 0; width: 100%">
			`,
			buttons: {},
			render: (html)=>{ 
				//html.parent().css({'background-color': 'white', 'background': 'unset', 'filter': `${ffs[id].filter}`});
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
					await character.setFlag('ffs', name, {config: {fontFamily}});
					d.render(true);
				});
				
				$fontWeight.change(async function(){
					let fontWeight = $(this).val();
					ffs[id].fontWeight = fontWeight;
					$(this).css({fontWeight});
					$(this).prev().css({fontWeight});
					await character.setFlag('ffs', name, {config: {fontWeight}});
					d.render(true);
				});

				$fontColor.change(async function(){
					let color = $(this).val();
					ffs[id].color = color;
					$(this).prevAll().css({color});
					await character.setFlag('ffs', name, {config: {color}})
					d.render(true);
				});
			},
			close:(html)=>{ return }
		},{...$(this).offset(), width: 150}).render(true);
	}));

	$header.find('h4.window-title').after($(`<a title="Sheet Filters" ><i class="fa-solid fa-eye"></i></a>`).click( async function(e){
		e.stopPropagation();
		let confirm = false;
		let values = character.flags.ffs[name].config.filter.split('%').map(f=>f.split('(')).map((f,i)=>!i?f:[f[0].split(' ')[1], f[1]]).reduce((a,f)=>{ return {...a, [f[0]]: f[1]}; },{})
		let filterConfig = new Dialog({
			title: `Filter Configuration`,
			content: `<center>
			 grayscale<input type="range" min="0" max="100" value="${values.grayscale||0}" class="grayscale" data-filter="grayscale">
			 sepia <input type="range" min="0" max="100" value="${values.sepia||0}" class="sepia" data-filter="sepia">
			 invert<input type="range" min="0" max="100" value="${values.invert||0}" class="invert" data-filter="invert">
			 saturate<input type="range" min="0" max="200" value="${values.saturate||100}" class="saturate" data-filter="saturate">
			 contrast<input type="range" min="0" max="200" value="${values.contrast||100}" class="contrast" data-filter="contrast">
			 brightness<input type="range" min="0" max="200" value="${values.brightness||100}" class="brightness" data-filter="brightness">
			</center>`,
			buttons: {
				confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
					confirm = true;
					let filter = [...html.find('input[type=range]')].map(f=>f.dataset.filter+'('+f.value+'%)').join(' ');
					await character.setFlag('ffs', [name], {config: {filter}});
					ffs[id].filter = filter;
				}},
				cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}
			},
			default: 'confirm',
			render: (html)=>{ 
				html.find('input[type=range]').change(async function(){
					let filter = [...html.find('input[type=range]')].map(f=>f.dataset.filter+'('+f.value+'%)').join(' ');
					$(`#${id}`).find('.ffs').css({filter})
				})
			},
			close:(html)=>{ 
				if (confirm) return;
				if (character.flags.ffs.config.filter) 
						$(`#${id}`).find('.ffs').css({filter: character.flags.ffs[name].config.filter});
					else
						$(`#${id}`).find('.ffs').css({filter: 'unset'});
				return }
		},{...$(this).offset()}).render(true);
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

	// I do not use the document.apps because it causes renders on every flag change I do. This way, I can ignore reloads on all ffs updates
	// character.apps[d.appId] = d;
	
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

ffs.configure = async function(name) {
	
	let config = game.settings.get('ffs', 'sheets')[name];
	if (!config) {
			let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: {}}}
			game.settings.set('ffs', 'sheets', sheets);
	}
	let i = await loadTexture(config.background);
	let width = i.orig.width;
	let height = i.orig.height;
	let confirm = false;
	let d = new Dialog({
		title: name,
		content: `<div class="ffs" style="position: relative; width: ${width}px; height:${height}px; margin: 20px;">
			<img src="${config.background}" style="position: absolute;">
			<div class="sizer ui-widget-content" style="background: unset; position: absolute; left: ${config.left}px; top:${config.top}px; width:${config.width}px; height: ${config.height}px; border: 2px dashed red;"></div>
		</div>`,
		buttons: {confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
			confirm = true;
			let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: config}}
			game.settings.set('ffs', 'sheets', sheets);
			return true;
			//await macro.setFlag('ffs', 'config', config)
		}},
		cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
		render: (html)=>{
			//html.css({height: 'max-content !important'});
			html.find('div.sizer').resizable({
				stop: async function( event, ui ) {
					config = {...config, ...ui.position, ...ui.size}
				}
			}).draggable({
				stop: async function( event, ui ) {
					config = {...config, ...ui.position}
				}
			})
			d._element.find('h4.window-title').after($(`<a title="Change Image" ><i class="fa-solid fa-image"></i></a>`).click(async function(){
				return new FilePicker({
					type: "image",
					displayMode: 'tiles',
					callback: async (path) => {
							//d.close();
							//await macro.setFlag('ffs', 'config.background', path);
							let i = await loadTexture(path);
							width = i.orig.width;
							height = i.orig.height;
							config.background = path;
							config.width = width;
							config.height = height;
							config.left = 1;
							config.top = 1;
							html.find('div.ffs').css({height, width});
							html.find('div.sizer').css({height, width, left: 0, top: 0});
							html.find('img').attr('src', path)
							d.setPosition()
						}
					}).browse();
			}));
			
		},
		close: async (html)=>{ return false;}
	}, {height: 'auto', width: 'auto'}).render(true);
  //await game.macros.get(macroId).update({'flags.-=ffs':null})
}

class ffsSettingsApp extends Dialog {
  
  constructor(data, options) {
    super(options);
    this.data = {
		title: `Freeform Sheets Configuration`,
		content: `<button class="add" style="margin-bottom: 1em;"><i class="fas fa-plus"></i>Add Sheet</button><center class="sheets"></center>`,
		render: (html)=>{
			let d = this;
			html.find('.sheets').append($(Object.entries(game.settings.get('ffs', 'sheets')).reduce((a, [name, config])=> {
				return a+=`<div><h3>${name}<a class="delete" name="${name}" style="float:right"><i class="fas fa-times"></i></a></h3>
				<a class="configure" name="${name}" ><img src="${config.background}" height=300></a></div>`}	,``)));
			d.setPosition({height: 'auto'});
			html.find('a.configure').click(function(){ffs.configure(this.name);});
			html.find('a.delete').click(async function(){
				let del = await Dialog.prompt({title:`Delete sheet ${this.name}?`,content:``, callback:(html)=>{return true}, rejectClose: false},{width:100});
				if (!del) return;
				let sheets = foundry.utils.deepClone(game.settings.get('ffs', 'sheets'));
				delete sheets[this.name];
				await game.settings.set('ffs', 'sheets', sheets);
				d.render(true);
			});
			html.find('button.add').click(async function(){
				let name = await Dialog.prompt({
					title:'Input sheet Name',
					content:`<input type="text" style="text-align: center;" autofocus></input>`, 
					callback:(html)=>{return html.find('input').val()}
				},{width:100});
				name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
				if (!name) return ui.notifications.warn('Sheets must have a name.');
				if (Object.keys(game.settings.get('ffs', 'sheets')).includes(name)) return ui.notifications.warn('That sheet name is already in use.');
				new FilePicker({
					type: "image",
					displayMode: 'tiles',
					callback: async (path) => { 
							let i = await loadTexture(path);
							let config = {background: path, width: i.orig.width, height: i.orig.height, left: 1, top: 1};
							let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: config}};
							await game.settings.set('ffs', 'sheets', sheets);
							ffs.configure(name);
							d.render(true);
						}
				}).render(true);
				
			})
		},
		buttons: {
			//confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{return}},
		},
		close: async (html)=>{ return;},}
};

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `freeform-sheets-module-settings`,
			height: 'auto',
			width: 'auto',
    	zIndex: 100,
    });
  }

  static getActiveApp() {
    return Object.values(ui.windows).find(app => app.id === "ffs-sheets-module-settings");
  }
  
  static async show(options = {}, dialogData = {}) {
    const app = this.getActiveApp()
    if (app) return app.render(false, { focus: true });
    return new Promise((resolve) => {
      options.resolve = resolve;
      new this(options, {	}).render(true, { focus: true });
    })
  }
}

class SettingsShim extends FormApplication {
  
  /**
   * @inheritDoc
   */
  constructor() {
    super({});
    ffsSettingsApp.show({});
  }
  
  async _updateObject(event, formData) {
  }
  
  render() {
    this.close();
  }
  
}

// full reset of a sheet for an actor
ffs.resetActorSheet = async function(actorId, name) {
  await game.actors.get(actorId).unsetFlag('ffs', name)
}

Hooks.once("init", async () => {
	game.settings.registerMenu("ffs", "ffsConfigurationMenu", {
		name: "Freeform Sheets Configuration",
		label: "Configuration",      // The text label used in the button
		hint: "Configuration for Freeform Sheets",
		icon: "fas fa-bars",               // A Font Awesome icon used in the submenu button
		type: SettingsShim,   // A FormApplication subclass which should be created
		restricted: true                   // Restrict this submenu to gamemaster only?
	});

	game.settings.register("ffs", "sheets", {
		name: "Freeform Sheets",
		hint: "Configurations for Freeform Sheets",
		scope: "world",      
		config: false,       
		type: Object,
		default: {},         
		onChange: value => { 
			$('div[id^=ffs]').each(function(){
				ui.windows[$(this).data().appid].close()
		})
		}
	});
});

// add actor director context menu options for each sheet

Hooks.on('getActorDirectoryEntryContext', (app, options)=>{
	for (let name of Object.keys(game.settings.get('ffs', 'sheets')))
		options.push(
			{
				"name": `${name.capitalize()} Freeform Sheet`,
				"icon": `<i class="fa-solid fa-file-lines"></i>`,
				"element": {},
				condition: li => {
          return true
        },
        callback: li => {
          const actor = game.actors.get(li.data("documentId"));
					actor.freeformSheet(name);
        }
			}
		)
})


// migration of macro configs
Hooks.on('ready', ()=>{
	if (Object.keys(game.settings.get('ffs', 'sheets')).length) return;
	game.settings.set('ffs', 'sheets', game.macros.filter(m=>m.flags.ffs?.config).reduce((a,m)=> {
		let config = m.flags.ffs?.config;
		if (!config.background) return a;
		return {...a, [m.command.match(/freeformSheet\((.*?)\)/)[0].match(/\'(.*?)\'/)[1]] : 
            m.flags.ffs.config}
		}	,{}))
})