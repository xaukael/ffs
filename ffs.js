/**  
 * @param {string} name name given to the sheet in the module configuration. all text and config on the sheet will be stored under in the actor's ffs.name flag
*/
Actor.prototype.freeformSheet = async function(name) {
  let character = this;
  if (character.permission<2) return ui.notifications.warn("You do not have adequate permissions to view this actor's sheet")
  name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
  
  //console.log(`Rendering Freeform Sheet ${name} for ${character.name}`)

  if (ffs.restirctedNames.includes(name)) return console.error("restricted name", name);
  let sheet = game.settings.get('ffs', 'sheets')[name];
  if (!sheet) return console.error(`sheet config for ${name} not found in game settings`);;
  let id = `ffs-${name}-${character.id}`;
  
  if ($(`div#${id}`).length) 
    return ui.windows[$(`div#${id}`).data().appid].close()//render(true).bringToTop();

  if (!character.getFlag('ffs', name)) 
    await character.setFlag('ffs', [name], {})
  if (!character.getFlag('ffs', name)?.config)
    await character.setFlag('ffs', [name], {config: {scale: 1, filter: '', showContentImages: false, showContentIcons: false, showContentText: true}});

  
  // perform cleanup of empty and NEW TEXT. Should not be necessary
  /*
  for (const [key, value] of Object.entries(character.getFlag('ffs', name))) {
    if (ffs.restirctedNames.includes(key)) continue;
    if (value.text.includes('img')) continue;
    if (!value.text || ($(`<span>${value.text}</span>`).text()=='') || value.text=='NEW TEXT') 
      await character.unsetFlag('ffs', `${name}.${key}`)
  }
  */
  ffs[id] = {...ffs[id], ...sheet, ...character.getFlag('ffs',`${name}.config`)};

  if (!ffs[id].hasOwnProperty('showContentImages')) ffs[id].showContentImages = false;
  if (!ffs[id].hasOwnProperty('showContentIcons')) ffs[id].showContentIcons = false;
  if (!ffs[id].hasOwnProperty('showContentText')) ffs[id].showContentText = true;
  
  let options = {width: 'auto', height: 'auto', id}
  if (ffs[id].position) options = {...options, ...ffs[id].position}

  let formatText = async function(text) {
    const charaData = game.release?.generation >= 10 ? character.system : character.data.data;
    const flags = game.release?.generation >= 10 ? character.flags : character.data.flags;
    const rollData = {...charaData, ...character.getRollData(), flags, name: character.name};
    text = await TextEditor.enrichHTML(text, {async:true, rolls:true, rollData});
    return Roll.replaceFormulaData(text, rollData, {missing: 0});
  }
//TextEditor.enrichHTML(text, {async:true, secrets:false, documents:false, links:false, rolls:true})
  let newSpan = async function(key, value){
    let updateSizeDebounce = foundry.utils.debounce((character,name,key,fontSize,y)=> {
      character.setFlag('ffs', [`${name}.${key}`], {fontSize, y}) 
      $('.font-tooltip').remove();
    }, 500);
    if (value.text==undefined) return await character.unsetFlag('ffs', `${name}.${key}`);
    let cursor = 'text';
    let match = value.text.match(/@([a-z.0-9_\-]+)/gi);
    if (match) {
      text = match[0];
      text = text.replace('@', '');
      if (!foundry.utils.hasProperty(game.system.model.Actor[character.type], value.text)) cursor = 'pointer';
      if (game.system.id=='worldbuilding' && foundry.utils.hasProperty(game.release?.generation>=10?character.system:character.data.data, value.text)) cursor = 'pointer';
    }
    let $span = $(`<span id="${key}" style="cursor: ${cursor}; position: absolute;">${await formatText(value.text)}<span>`);
    $span.css({left: value.x+'px', top: value.y+'px', fontSize: value.fontSize})
    let click = {x: 0, y: 0};
    $span
    .focusout(async function(){
      $(this).find('span').remove();
      let input = $(this).html().trim();
      if (input == "" || input == "NEW TEXT") {
        await character.unsetFlag('ffs', `${name}.${key}`);
        return $(this).remove();
      }
      $(this).html(await formatText(input))
      await character.setFlag('ffs', [`${name}.${key}`], {text: input});
      $(this).draggable('enable')
      $(this).prop('role',"")
      $(this).prop('contenteditable',"false")
    })
    .keydown(function(e){
      e.stopPropagation();
      if (e.key != "Enter") return;
      return $(this).blur();
    })
    .focusin(function(){
      let selection = window.getSelection();
      let range = document.createRange();
      range.selectNodeContents(this);
      selection.removeAllRanges();
      selection.addRange(range);
      $(this).draggable('disable');
    })
    .on("wheel", function(e) {
      if ($(this).parent().hasClass('locked')) return;
      let fontSize = parseInt($(this).css('font-size'))
      let change = 1;
      if (e.shiftKey) change = Math.max(Math.floor(fontSize/12), 1)*2;
      change *= e.originalEvent.wheelDelta>0?-1:1;
      if (game.settings.get('ffs', 'invertSizing')) change*=-1;
      fontSize = Math.max(fontSize+change, 2);
      if (fontSize==2) return console.log('font size minimum reached');
      let y = (parseInt($(this).css('top'))-change);
      //if ($(this).text()==""&&$(this).html().includes('img')) y+= change/2;
      $(this).css({fontSize: fontSize +"px", top: y+'px'});
      $(this).find('img').height(fontSize)
      $('.font-tooltip').remove();
      $('body').append($(`<span class="font-tooltip" style="position: absolute; top: ${e.clientY-10}px; left: ${e.clientX+10}px; pointer-events: none; color: white; background: #000; border: 1px solid white; padding:2px; z-index:1000;">${fontSize}px</span>`));
      updateSizeDebounce(character,name,key,fontSize,y);
    })
    .on('copy', function(e){
      let selection = window.getSelection();
      e.originalEvent.clipboardData.setData('text/plain', selection.toString());
      e.preventDefault();
    })
    .draggable({
      start: function(e){
        //$(this).css('pointer-events', 'none')
        $(this).css('cursor', 'grabbing');
        click.x = e.clientX;
        click.y = e.clientY;
      },
      drag: function(e, data) {
        let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0]);
        let appScale = Number($(this).closest('.app').css('transform').split('matrix(')[1]?.split(',')[0]);
        if (appScale) scale *= appScale;
        let original = data.originalPosition;
        data.position = {
          left: Math.round((e.clientX-click.x+original.left)/scale),
          top:  Math.round((e.clientY-click.y+original.top )/scale)
        };
        $(this).css('cursor', 'grabbing');
      },
      stop: async function(e, data){
        let appScale = Number($(this).closest('.app').css('transform').split('matrix(')[1]?.split(',')[0]);
        let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0]);
        if (appScale) scale *= appScale;
        data.position = {
          left: Math.round((e.clientX-click.x+data.originalPosition.left)/scale),
          top:  Math.round((e.clientY-click.y+data.originalPosition.top )/scale)
        };
        await character.setFlag('ffs', [`${name}.${key}`], {x: data.position.left, y: data.position.top});
        //$(this).css('pointer-events', 'all')
        $(this).css({cursor});
      }
    })
    .contextmenu(function(e){
      e.stopPropagation();
      e.preventDefault();
      if ($(this).parent().hasClass('locked')) return;
      let span = character.getFlag('ffs', name)[key];
      let text = span.text;
      if ((e.ctrlKey || text.includes('@') || text.includes('[[') || (text.includes('<') && text.includes('>'))) && !e.shiftKey) {
        let options = $(this).offset();
        options.left -= 190;
        options.top -= 45;
        let valueDialog = new Dialog({
          title: key,
          content: `<textarea type="text" value="" style=" margin-bottom:.5em;" autofocus></textarea>`,//width: calc(100% - 2.3em); <button class="at" style="width: 2em; height: 26px; float: right; line-height: 22px;">@</button>
          buttons: {confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
            confirm = true;
            let input = html.find('textarea').val();
            if (input == "" || input == "NEW TEXT") {
              console.log(`removing span`, name, key)
              await character.unsetFlag('ffs', `${name}.${key}`);
              return $(this).remove();
            }
            $(this).html(await formatText(input))
            $(this).find('a.content-link').each(function(e){
              let content = fromUuidSync(this.dataset.uuid);
              let img = content?.img;
              if (!img) return true;
              if (!(ffs[id].showContentText)) $(this).html('');
              if (ffs[id].showContentImages) $(this).prepend($(`<img src="${img}">`));
              this.dataset.tooltip = content.name;
            });
            $(this).find('img').height(span.fontSize)
            await character.setFlag('ffs', `${name}.${key}`, {text: input});
          }},
          cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
          default: 'confirm',
          render: (html)=>{
            $(html[0]).append(`<style>#${valueDialog.id}{min-width:400px; height:auto !important; width:auto !important;}</style>`);
            html.find('textarea').val(text);
            html.find('textarea').select();
            html.parent().parent() 
            .mouseenter(function(){$(`#${key}`).css({'outline': 'red solid 2px'})})
            .mouseleave(function(){$(`#${key}`).css({'outline': ''})})
            //function buildObjectElements(rollData, el, objectPath) {
            //let property = getProperty(rollData, objectPath)
            function buildObjectElements(el, objectPath) {
              let property = getProperty(character, objectPath)
              if (property===null) return;
              for (let key of Object.keys(property)) {
                let prop = foundry.utils.getProperty(character, `${objectPath}.${key}`)
                //let prop = foundry.utils.getProperty(rollData, `${objectPath}.${key}`)
                if (typeof(prop) === 'object' && prop != null) {
                  let objectel = $(`
                  <div class="object-path" data-path="${objectPath}.${key}" style="${objectPath=="system"?'':'margin-left: 1em;'}">
                    <a>${key} +</a>
                  </div>`)
                  el.append(objectel)
                  buildObjectElements(objectel, `${objectPath}.${key}`)
                  //buildObjectElements(rollData, objectel, `${objectPath}.${key}`)
                }
                else
                  el.append($(
                  `<div class="value-path" data-path="${objectPath}.${key}" title="@${(objectPath+'.'+key).replace('system.','')}" style="${objectPath=="system"?'':'margin-left: 1em;'}">
                    <a>${key} : ${typeof(prop)=="string"?`"${prop}"`:prop}</a>
                  </div>`));
              }
              return el;
            }
            //html.find('button.at')
            let $at = $(`<a><i class="fa-solid fa-at"></i></a>`)
            $at.click(function(e){
              $('body').find('.object-path-root').remove();
              let $atOptions = $(`<div class="object-path-root" data-path="system" 
              style="z-index: 1000; width: max-content; height: max-content; color: white; border: 1px solid black; box-shadow: 0 0 20px var(--color-shadow-dark);
              background: url(../ui/denim075.png) repeat; border-radius: 5px; padding: .5em; padding-left: -10px;
              position: absolute; left:${e.clientX-10}px; top:${e.clientY}px;">
              <a></a></div>`)
              .mouseenter(function(e){
                $(this).removeClass('hide');
              })
              .mouseleave(async function(e){
                $(this).addClass('hide');
                await new Promise((r) => setTimeout(r, 750));
                if ($(this).hasClass('hide'))
                  $(this).remove();
              })
              buildObjectElements($atOptions, `${(game.release?.generation >= 10)?'system':'data.data'}`)
              //let rollData = {};
              //rollData.system = character.getRollData();
              //buildObjectElements(rollData, $atOptions, `system`)//${(game.release?.generation >= 10)?'':''}
              $atOptions.find(`.object-path, .value-path`).hide()
              $atOptions.children(`.object-path, .value-path`).show()
              $atOptions.find(`a`).click(function(){
                $(this).parent().children('div').toggle()
              })
              $atOptions.find(`.value-path > a`).click(function(){
                html.find('textarea').val('@'+$(this).parent().data().path.replace('system.','').replace('data.data.', ''))
              })
              $('body').append($atOptions)
            })
            valueDialog.element.find('.window-header > .window-title').after($at)
          },
          close: ()=>{
            $(`#${key}`).css({'outline': ''})
            return $('body').find('.object-path-root').remove();
          }
        },{...options, id: `${id}-${key}-dialog`}).render(true)

        return;
      }
      $(this).html(text);
      $(this).prop('role',"textbox")
      $(this).prop('contenteditable',"plaintext-only") // TEST
      $(this).trigger('focusin');//focus()
    })
    .dblclick(function(e){
      let text = character.getFlag('ffs', name)[key].text;
      let match = text.match(/@([a-z.0-9_\-]+)/gi);
      if (!match) return; 
      match.findSplice(i=>i=='@UUID')
      text = match[0];
      text = text.replace('@', '');
      if (foundry.utils.hasProperty(game.system.model.Actor[character.type], text) || 
          (game.system.id=='worldbuilding' && foundry.utils.hasProperty(character.system, text))) {
        let val = foundry.utils.getProperty(game.release?.generation>=10?character.system:character.data.data, text);
        if (typeof(val)=='object') return;
        let options = $(this).offset();
        options.left -= 190;
        options.top -= 45;
        new Dialog({
          title: `Edit ${text}`,
          content: `<input type="${typeof(val)}" value="" style="width: 100%; margin-bottom:.5em; text-align: center;" autofocus></input>`,
          buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
            let input = html.find('input').val();
            if (html.find('input')[0].type == 'number') input = Number(input)
            if (!input && input != 0) return ui.notifications.warn('empty values can be problematic for freeform sheets');
            await character.update({[`${(game.release?.generation >= 10)?'system':'data'}.${text}`]: input});
          }}},
          default: 'confirm',
          render: (html) =>{
            html.find('input').val(val).select();
          },
          close: ()=>{ return
          }
        },{...options, id: `${id}-${key}-value-dialog`}).render(true);
      }
      if (text == 'name') {
        let val = foundry.utils.getProperty(character, text);
        if (typeof(val)=='object') return;
        let options = $(this).offset();
        options.left -= 190;
        options.top -= 45;
        new Dialog({
          title: `Edit ${text}`,
          content: `<input type="${typeof(val)}" value="${val}" style="width: 100%; margin-bottom:.5em; text-align: center;" autofocus></input>`,
          buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
            let input = html.find('input').val();
            if (!input && input != 0) return ui.notifications.warn('empty values can be problematic for freeform sheets');
            await character.update({"name": input});
          }}},
          default: 'confirm',
          render: (html) =>{
            html.find('input').select();
          },
          close: ()=>{ return
          }
        },{...options, id: `${id}-${key}-value-dialog`}).render(true);
      }
      if (foundry.utils.hasProperty({flags:character.flags}, text)) {
        let flag = text.split('.');
        flag.shift();
        let scope = flag.shift();
        let prop = flag.join('.');
        let val = character.getFlag(scope, prop);
        if (typeof(val)=='object') return;
        let options = $(this).offset();
        options.left -= 190;
        options.top -= 45;
        new Dialog({
          title: `Edit ${text}`,
          content: `<input type="${typeof(val)}" value="${val}" style="width: 100%; margin-bottom:.5em; text-align: center;" autofocus></input>`,
          buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
            let input = html.find('input').val();
            if (html.find('input')[0].type == 'number' || !isNaN(input)) input = Number(input)
            if (!input && input != 0) return ui.notifications.warn('empty values can be problematic for freeform sheets');
            await character.setFlag(scope, prop, input);
          }}},
          default: 'confirm',
          render: (html) =>{
            html.find('input').select();
          },
          close: ()=>{ return
          }
        },{...options, id: `${id}-${key}-value-dialog`}).render(true);
      }
      
    })
    $span.find('a.content-link').each(function(e){
      let content = fromUuidSync(this.dataset.uuid);
      let img = content?.img;
      if (!img) return true;
      if (!(ffs[id].showContentText)) $(this).html('');
      if (ffs[id].showContentImages) $(this).prepend($(`<img src="${img}">`));
      this.dataset.tooltip = content.name;
    });
    $span.find('img').height(value.fontSize)
    return $span;
  }

  let d = new Dialog({
    title: `${character.name}`,
    content: `<div class="sizer" style="position:relative;"><div class="ffs" style="height:${ffs[id].height}px; width:${ffs[id].width}px;"></div></div>`,
    buttons: {},
    render: async (html)=>{
      //console.log(`${id} render`, ffs[id])
      let {width, height, left, top, background, color , scale , fontFamily, fontWeight, fontSize, filter, locked, showContentIcons} = ffs[id];
      
      // apply configs
      html.css({height: 'max-content !important'});
      html.find('style').remove();
      let $sheet = html.find('div.ffs');
      $sheet.before($(`<style>
        #${id} {height: auto !important; width: auto !important;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs {font-family: ${fontFamily}; font-weight: ${fontWeight}; 
          cursor: cell; position: relative; overflow-y: hidden; overflow-x: hidden; overflow-wrap: break-word;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs.locked {cursor: default;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs.locked > span {cursor: default !important;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > img.background {pointer-events: none; position: absolute; max-width: unset; }
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs * {border: unset !important; padding: 0; background: unset; background-color: unset; color: ${color};} 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span > input:focus {box-shadow: unset; } 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span:focus-visible {outline-color:white; outline: ${color} solid 2px; outline-offset: 3px;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span { white-space: wrap; position: absolute; }
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span a.content-link > img {margin-right: .1em;} 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span a:hover {text-shadow: 0 0 8px ${color} }
        ${!showContentIcons?`#${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span a.content-link > i {display:none;} 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span  a.inline-roll > i {display:none;} `:''}
      </style>`));
      html.parent().css({background:'unset'});
      let bgScale = game.settings.get('ffs', 'sheets')[name].scale || 1;
      $sheet.parent().css({height: `${height*scale}px`, width: `${width*scale}px`});
      $sheet.css({'transform-origin': 'top left', 'transform': `scale(${scale})`});
      
      let i = await loadTexture(background);
      $sheet.append($(`<img src="${background}" class="background" style="top:-${top}px; left: -${left}px; width:${i.orig.width*bgScale}px; height:${i.orig.height*bgScale}px; filter: ${filter};">`));

      if (locked) $sheet.addClass('locked')
      else $sheet.removeClass('locked')

      // make spans
      for (const [key, value] of Object.entries(character.getFlag('ffs', name))) 
        if (ffs.restirctedNames.includes(key)) continue;
        else $sheet.append(await newSpan(key, value));
      
      // apply sheet events for creating new spans
      
      $sheet.contextmenu(async function(e){
        if (locked) return;
        if (!!e?.originalEvent && e?.originalEvent?.target.nodeName != "DIV") return;
        let id = randomID();
        let value = {x: e.offsetX, y: e.offsetY-8, text: e.ctrlKey?"@":"NEW TEXT", fontSize: fontSize || 16};
        await character.setFlag('ffs', [`${name}`], {[`${id}`]: value});
        let $span = await newSpan(id, value);
        $(this).append($span);
        $span.contextmenu();
      })
      .on('drop', async function(e){
        if (locked) return;
        e.originalEvent.preventDefault();
        let data;
        let text = e.originalEvent.dataTransfer.getData("Text");
        console.log(text)
        try{data = JSON.parse(text);}catch(e){}
        if (typeof data == 'object' && data.type!= "Tile")
          if (game.release?.generation >= 10) text = fromUuidSync(data.uuid).link
          else text = CONFIG[data.type].collection.instance.get(data.id).link
        if (typeof data == 'object' && data.type== "Tile")
          text = `<img src="${data.texture.src}">`
        if (!text) return;
        let id = randomID();
        let value = {x: e.offsetX, y: e.offsetY-8, text, fontSize: fontSize};
        await character.setFlag('ffs', [`${name}`], {[`${id}`]: value});
        let $span = await newSpan(id, value);
        $(this).append($span);
      })

      if (locked) html.find(`.ffs > span`).draggable('disable')
      
    },
    close: async (html)=>{
        if (ffs[id].hook) Hooks.off(`update${this.documentName}`, ffs[id].hook);
        $(`div[id^="${id}-"]`).each(function(){
          ui.windows[$(this).data().appid].close();
        })
        return;
      }
  }, options);
  
  if (ffs[id].hook) Hooks.off(`update${this.documentName}`, ffs[id].hook)
  ffs[id].hook = 
    Hooks.on(`update${this.documentName}`, async (doc, updates, context, userId)=>{
      //console.log(updates);
      if (doc.id!=character.id) return;
      if (!d.element) return;
      if (foundry.utils.hasProperty(updates, "flags.ffs") && game.user.id == userId) return true;
      if (game.user.id != userId && foundry.utils.hasProperty(updates, `flags.ffs.${name}.config`)) {
        ffs[id] = {...ffs[id], ...foundry.utils.getProperty(updates, `flags.ffs.${name}.config`)};
        return d.render(true);
      }
      if (game.user.id != userId && foundry.utils.hasProperty(updates, `flags.ffs.${name}`)) {
        for (let key of Object.keys(updates.flags.ffs[name])) {
          let $sheet = d.element.find('div.ffs');
          if (key.includes('-=')) {
            key = key.replace('-=', '');
            return $sheet.find(`span#${key}`).remove();
          }
          $sheet.find(`span#${key}`).remove();
          let value = doc.flags.ffs[name][key];
          $sheet.append(await newSpan(key, value));
        }
        return;
      }
      for (let [key, value] of Object.entries(character.getFlag('ffs', name)).filter(([id, span])=>span.text?.includes('@'))) {
        let $sheet = d.element.find('div.ffs');
        $sheet.find(`span#${key}`).remove();
        let value = doc.flags.ffs[name][key];
        $sheet.append(await newSpan(key, value));
      }
        //d.element.find(`span#${spanId}`).html(await formatText(span.text)).find('img').height(span.fontSize);
    });

  //let waitRender = 100; if (!d._element)  while (!d._element  && waitRender-- > 0) await new Promise((r) => setTimeout(r, 50));

  Hooks.once('renderDialog', (app, html, options)=>{
    // set header buttons
    app.object=character;
    html.closest('.dialog').addClass('sheet')
    let $header  = html.find('header');
    //if (game.user.isGM)
    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Sheet"><i class="fas fa-cog"></i></a>`).click(function(e){
      //if (e.ctrlKey) return ffs.configure(name) ${game.user.isGM?'<br>Ctrl+Click FFS Config':''}
      new DocumentSheetConfig(character).render(true)
    }));
    // to remember last position  
    html.click(function(){if (app._element) ffs[id].position = app._element.offset(); })


    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Fix Sheet"><i class="fas fa-tools"></i>`).click(function(e){
      let sheet = character.getFlag('ffs', name)
      let content = '';
      for (const [key, value] of Object.entries(sheet)) {
        if (ffs.restirctedNames.includes(key)) continue;
        content += `<div class="span" data-id="${key}"><label>${key} {x:${value.x}, y:${value.y}, fontSize: ${value.fontSize}}
        <a data-id="${key}" style="float:right; margin: 0 .2em;" class="delete">Delete</a>
        <a data-id="${key}" style="float:right; margin: 0 .2em;" class="save">Save</a></label><textarea id="${key}"></textarea><hr></div>`
      }
      let d = new Dialog({
          title:`Fix FFS - ${name} - ${character.name} `,
          content,
          buttons:{},
          render:(html)=>{
            html.find('div.span')
              .mouseenter(function(){$(`#${this.dataset.id}`).css({'outline': 'red solid 2px'})})
              .mouseleave(function(){$(`#${this.dataset.id}`).css({'outline': ''})})
            $(html[0]).append(`<style>#${d.id}{ height:auto !important;}</style>`);
            for (const [key, value] of Object.entries(sheet)) {
              if (ffs.restirctedNames.includes(key)) continue;
              html.find(`#${key}`).val(value.text)
            }
            html.find('a.save').click(async function(e){
              await character.setFlag('ffs', `${name}.${this.dataset.id}.text`, $(this).parent().next().val())
              ui.windows[$(`#ffs-${name}-${character.id}`).data().appid].render(true)
            })
            html.find('a.delete').click(async function(e){
              await character.unsetFlag('ffs', `${name}.${this.dataset.id}`)
              $(this).parent().parent().remove();
              ui.windows[$(`#ffs-${name}-${character.id}`).data().appid].render(true)
            })
          }
        },{resizable:true}).render(true)
    }));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Help"><i class="fas fa-question-circle"></i></a>`).click(function(e){
      new Dialog({
        title: `Freeform Sheet Help`,
        content: `<center>
        <p><b>Right-Click</b> anywhere on the sheet with the <i class="fas fa-plus"></i> cursor to spawn a <b>"NEW TEXT"</b> element.</p>
        <p><b>Right-Click</b> existing text elements while the text cursor is showing to edit the text.</p>
        <p>Changes to the text will be saved on focus loss (clicking something else) or pressing <b>Enter</b>. <br>If there is no text entered or the value is still "NEW TEXT" the element will be removed.</p>
        <p>Fields with an <i class="fas fa-at"></i> will open a dialog because these texts can be rather long and show the value rather than the placeholder when rendered on the sheet.</p>
        <p>You can force this dialog to open for a field by holding <b>Ctrl</b> when you <b>Right-Click</b>.</p>
        <p><b>Double Left-Click</b> a text defined by an <i class="fas fa-at"></i> to open a dialog to edit the referenced value. <br>This only works on actor data that can be edited.</p>
        <p><b>Left-Click</b> and <b>Drag</b> text elements to reposition them</p>
        <p><b>Scroll</b> while hovering a text element to adjust the size of the text.<br> Hold <b>Shift</b> while scrolling to rapidly scale.</p>
        <p>Entities can be dragged to the sheet from their directories or from sheets. <br>This will create clickable links to content on the sheet. 
        <br><b>Right-Click</b> the <i class="fas fa-font"></i> icon in the header to toggle the icons for content links.</p>
        <p>The <i class="fas fa-font"></i> icon in the header will show the font config. 
        <br>In v10, more fonts may be added by the GM in Foundry's core settings under <b><a onclick="new FontConfig().render(true)">Additional Fonts</a></b>.
        <br>In v9, users will need to type in a valid font name.</p>
        <p>The <i class="fas fa-eye"></i> icon in the header will show the sheet filter config.</p>
        <p>The <i class="fas fa-lock"></i> icon in the header will toggle locking of the elements on the sheet.
        <br>No changes can be made to the elements on the sheet while locked.
        <br>Content links can still be clicked, and <i class="fas fa-at"></i> texts can still be double clicked to edit.
        </p>
        </center>`,
        buttons: {},
        render: (html)=>{ 
        },
        close:(html)=>{ return }
      },{width: 600, id: `${id}-help-dialog`}).render(true);
    }).dblclick(function(e){e.stopPropagation();}));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Sheet Font"><i class="fas fa-font"></i></a>`).click(function(e){
      if ($(`#${id}-font-dialog`).length) return ui.windows[$(`div#${id}-font-dialog`).data().appid].bringToTop();
      new Dialog({
        title: `Font Configuration`,
        content: `
        ${(game.release?.generation < 10)?
          `<input type="text" class="fontFamily" placeholder="font name" style="width:100%">`:
          [...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%"  data-tooltip="Font Family">`) + `</select>`
        }
        ${[...Array(10)].map((x,i)=>(i+1)*100).reduce((a,w)=>a+=`<option value="${w}" style="font-weight: ${w};">${w}</option>`,`<select class="fontWeight" style="width:100%" data-tooltip="Font Weight">`)+`</select>`}
        ${[...Array(30)].map((x,i)=>Math.max((i+2)*2*2)).reduce((a,w)=>a+=`<option value="${w}">${w}px</option>`,`<select class="fontSize" style="width:100%" data-tooltip="Default Font Size">`)+`</select>`}
        <input class="fontColor" type="color" value="" style="border:unset; padding: 0; width: 100%"  data-tooltip="Font Color">
        `,
        buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{}}},
        render: (html)=>{ 
          //html.parent().css({'background-color': 'white', 'background': 'unset', 'filter': `${ffs[id].filter}`});
          let $fontFamily = html.find('.fontFamily');
          let $fontWeight = html.find('.fontWeight');
          let $fontColor = html.find('.fontColor');
          let $fontSize = html.find('.fontSize');
          $fontFamily.val(ffs[id].fontFamily);
          $fontWeight.val(ffs[id].fontWeight);
          $fontColor.val(ffs[id].color);
          $fontSize.val(ffs[id].fontSize||16);
          
          $fontFamily.css('font-weight', $fontWeight.val());
          $fontFamily.css('font-family', $fontFamily.val());
          $fontWeight.css('font-weight', $fontWeight.val());
          $fontWeight.css('font-family', $fontFamily.val());
          //$fontColor.prevAll().css({'color': ffs[id].color})
          
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

          $fontSize.change(async function(){
            let fontSize = Number($(this).val());
            ffs[id].fontSize = fontSize;
            await character.setFlag('ffs', name, {config: {fontSize}});
            d.render(true);
          });

          $fontColor.change(async function(){
            let color = $(this).val();
            ffs[id].color = color;
            await character.setFlag('ffs', name, {config: {color}})
            d.render(true);
          });
        },
        close:(html)=>{ return }
      },{...$(this).offset(), width: 150, id: `${id}-font-dialog`}).render(true);
    }));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Sheet Links"><i class="fas fa-link"></i>`).click(function(e){   
      if ($(`#${id}-links-dialog`).length) return ui.windows[$(`div#${id}-links-dialog`).data().appid].bringToTop();
      new Dialog({
        title: `Link Configuration`,
        content: `
        
        <input type="checkbox" class="image" name="image" value="Car">
        <label for="image"> Images</label><br>
        <input type="checkbox" class="icon" name="icon" value="Bike">
        <label for="icon"> Icons</label><br>
        <input type="checkbox" class="text" name="text" value="Boat">
        <label for="text"> Text</label><br>
        `,
        buttons: {},//confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{}}},
        render: (html)=>{ 
          
          html.find('input.icon').change(async function(){
            let showContentIcons = $(this).is(':checked');
            ffs[id].showContentIcons = showContentIcons;
            await character.setFlag('ffs', name, {config: {showContentIcons}});
            d.render(true);
          }).prop('checked', ffs[id].showContentIcons);

          html.find('input.image').change(async function(){
            let showContentImages = $(this).is(':checked');
            ffs[id].showContentImages = showContentImages;
            await character.setFlag('ffs', name, {config: {showContentImages}});
            d.render(true);
          }).prop('checked', ffs[id].showContentImages);

          html.find('input.text').change(async function(){
            let showContentText = $(this).is(':checked');
            ffs[id].showContentText = showContentText;
            await character.setFlag('ffs', name, {config: {showContentText}});
            d.render(true);
          }).prop('checked', ffs[id].showContentText);
        },
        close:(html)=>{ return }
      },{...$(this).offset(), width: 150, id: `${id}-links-dialog`}).render(true);
    }).dblclick(function(e){e.stopPropagation();}));
    /*
    .contextmenu(async function(){
      let hideContextIcons = !ffs[id].hideContextIcons;
      ffs[id].hideContextIcons = hideContextIcons;
      await character.setFlag('ffs', name, {config: {hideContextIcons}});
      d.render(true);
    })*/

    
    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Sheet Filter"><i class="fas fa-eye"></i></a>`).click( async function(e){
      if ($(`#${id}-filter-dialog`).length) return ui.windows[$(`div#${id}-filter-dialog`).data().appid].bringToTop();
      e.stopPropagation();
      let confirm = false;
      let values = character.getFlag('ffs', name).config.filter.split('%').map(f=>f.split('(')).map((f,i)=>!i?f:[f[0].split(' ')[1], f[1]]).reduce((a,f)=>{ return {...a, [f[0]]: f[1]}; },{})
      let filterConfig = new Dialog({
        title: `Filter Configuration`,
        content: `<center>
        grayscale <span>${values.grayscale||0}%</span><input type="range" min="0" max="100" value="${values.grayscale||0}" class="grayscale" data-filter="grayscale">
        sepia <span>${values.sepia||0}%</span><input type="range" min="0" max="100" value="${values.sepia||0}" class="sepia" data-filter="sepia">
        invert <span>${values.invert||0}%</span><input type="range" min="0" max="100" value="${values.invert||0}" class="invert" data-filter="invert">
        saturate <span>${values.saturate||100}%</span><input type="range" min="0" max="500" value="${values.saturate||100}" class="saturate" data-filter="saturate">
        contrast <span>${values.contrast||100}%</span><input type="range" min="0" max="200" value="${values.contrast||100}" class="contrast" data-filter="contrast">
        brightness <span>${values.brightness||100}%</span><input type="range" min="0" max="200" value="${values.brightness||100}" class="brightness" data-filter="brightness">
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
            $(this).prev().html($(this).val()+'%')
            let filter = [...html.find('input[type=range]')].map(f=>f.dataset.filter+'('+f.value+'%)').join(' ');
            $(`#${id}`).find('.ffs > img.background').css({'filter':filter})
          })
        },
        close:(html)=>{ 
          if (confirm) return;
          if (character.getFlag('ffs', name).config.filter) 
              $(`#${id}`).find('.ffs > img.background').css({filter: character.getFlag('ffs', name).config.filter});
            else
              $(`#${id}`).find('.ffs > img.background').css({filter: 'unset'});
          return }
      },{...$(this).offset(), id: `${id}-filter-dialog`}).render(true);
    }).dblclick(function(e){e.stopPropagation();}));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Scale +10%"><i class="fas fa-plus"></i></a>`).click( async function(e){
      e.stopPropagation();
      let {scale, width, height} = ffs[id];
      scale += .1;
      scale = Math.round(scale*10)/10;
      ffs[id].scale = scale;
      $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
      await character.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));

    $header.find('h4.window-title').after($(`<a class="zoom ffs-tool"  data-tooltip="Reset Scale"><b>${Math.round(ffs[id].scale*100)}%</b></a>`).click( async function(e) {
      let {scale, width, height} = ffs[id];
      scale = 1;
      ffs[id].scale = 1;
      $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
      await character.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Scale -10%"><i class="fas fa-minus"></i></a>`).click( async function(e){
      e.stopPropagation();
      let {scale, width, height} = ffs[id];
      scale -= .1;
      scale = Math.round(scale*10)/10;
      ffs[id].scale = scale;
      $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
      await character.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));

    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Lock Sheet"><i class="fas fa-lock${ffs[id].locked?'':'-open'}"></i></a>`).click( async function(e){
      let locked = !ffs[id].locked;
      if (!locked) {
        //$(`#${id}`).find(`.ffs > span`).draggable('enable')
        $(this).find('i').removeClass('fa-lock').addClass('fa-lock-open')
        $(`#${id}`).find(`.ffs`).removeClass('locked')
      }
      else {
        //$(`#${id}`).find(`.ffs > span`).draggable('disable')
        $(this).find('i').removeClass('fa-lock-open').addClass('fa-lock')
        $(`#${id}`).find(`.ffs`).addClass('locked')
      }
      ffs[id].locked = locked;
      await character.setFlag('ffs', name, {config: {locked}})
      d.render(true);
      
    }).dblclick(function(e){e.stopPropagation();}));

    //$header.find('.ffs-tool').hide(); $header.mouseenter(function(){$(this).find('.ffs-tool').show()}).mouseleave(function(){$(this).find('.ffs-tool').hide()})

    if (Object.keys(game.settings.get('ffs', 'sheets')).length>1)
    $header.find('h4.window-title').before($(`<a title="Sheets" style="margin: 0 .5em 0 0;"><i class="fas fa-file-alt"></i></a>`).click( async function(e){
      ffs.sheets(character, e);
    }).dblclick(function(e){e.stopPropagation();}));
  }); // end renderDialog hook once
  d.render(true);
  return d;
}

var ffs = {};

ffs.restirctedNames = ['config', 'template'];

ffs.sheets = async function(actor, e=null) {
  let options = {id: 'freeform-sheets', width: 'auto'};
  if ($(`#${options.id}`).length) return ui.windows[$(`#${options.id}`).data().appid].bringToTop();
  if (e) options = {...options, ...{left: e.originalEvent.clientX, top: e.originalEvent.clientY}};
  
  let content = `<center>`;
  for (let [name, config] of Object.entries(game.settings.get('ffs', 'sheets'))) {
    let i = await loadTexture(config.background);
    if (!config.scale) config.scale = 1;
    content +=`
    <a class="sheet" name="${name}" title="${name}" style="transform: scale(${config.scle}); width:${(config.width)/4}px; height:${(config.height)/4}px; overflow: hidden;
    background: url(${config.background}) no-repeat; background-position: top -${config.top/4}px left -${config.left/4}px;
    background-size: ${i.orig.width/4}px ${i.orig.height/4}px; margin: 0px 10px 10px 10px; filter: ${actor.getFlag('ffs', name)?.config?.filter};">
    </a>`;
  }
  content += `</center>`;
  let s = new Dialog({
    title: `Freeform Sheets`,
    content,
    render: (html)=>{
      html.find('a.sheet').click(async function(){
        await actor.freeformSheet(this.name);
        s.bringToTop();
      });
    },
    buttons: {},
    close: async (html)=>{ return false;}
  }, options).render(true);
}

// clone a sheet of name(string) from source(actor) to target(actor)
ffs.clone = async function(name, source, target) {
  let sheet = game.settings.get('ffs', 'sheets')[name];
  if (!sheet) return console.error(`sheet config for ${name} not found in game settings`);;
  if (!source || !target) return console.error('source or target actor not defined');
  let flag = foundry.utils.deepClone(await source.getFlag('ffs', name));
  delete flag.template;
  await target.setFlag('ffs', name, flag )
  return target.freeformSheet(name);
}

// full reset of a sheet of name for an actor
ffs.resetActorSheet = async function(actor, name) {
  await actor.unsetFlag('ffs', name)
}

ffs.configure = async function(name) {
  if ($(`#${name}-ffs-configuration`).length)  return ui.windows[$(`div#${name}-ffs-configuration`).data().appid].bringToTop();
  let config = {...game.settings.get('ffs', 'sheets')[name]};
  if (!config) {
      let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: {}}}
      game.settings.set('ffs', 'sheets', sheets);
  }
 
  if (!config.hasOwnProperty('scale')) config.scale = 1;
  let i = await loadTexture(config.background);
  let width = i.orig.width;
  let height = i.orig.height;
  let confirm = false;
  let c = new Dialog({
    title: name,//width: ${width}px; height:${height}px;
    content: `<div class="ffs" style="position: relative;  margin: 10px;">
      <img src="${config.background}" style="width: ${width*config.scale}px;">
      <center style="position: absolute; left: 0px; top: 1px; width: 100%; height: 100%;"> 
        <div style="padding-top: 50%; position: relative;">
        ${'abcdefghijklm'.split('').map(a=>a.toUpperCase()+a).join(' ')+'<br>'+
        'nopqrstuvwxyz'.split('').map(a=>a.toUpperCase()+a).join(' ')+
        '<br> + - 1 2 3 4 5 6 7 8 9 0'}</div>
      </center>
      <div class="sizer ui-widget-content" style="background: unset; position: absolute; left: ${config.left}px; top:${config.top}px; width:${config.width}px; height: ${config.height}px; border: 2px dashed red;"></div>
    </div><style>#${name}-ffs-configuration {height: auto !important; width: auto !important;}</style>`,
    buttons: {confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
      confirm = true;
      let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: config}}
      game.settings.set('ffs', 'sheets', sheets);
      return true;
      //await macro.setFlag('ffs', 'config', config)
    }},
    cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
    close: (html)=>{return},
    render: (html)=>{
      $(html[0]).append(`<style>#${c.id}{height:auto !important; width:auto !important;}</style>`);
      html.find('center > div').css({fontFamily: config.fontFamily, color: config.color, fontSize: config.fontSize});
      html.find('div.sizer').resizable({
        stop: async function( event, ui ) {
          config = {...config, ...ui.position, ...ui.size}
        }
      }).draggable({
        stop: async function( event, ui ) {
          config = {...config, ...ui.position}
        }
      });
      /*
      .on('wheel', function(e){
        config.scale = (e.originalEvent.wheelDelta<0)?config.scale+.05:config.scale-.05;
        html.find('img').css({width: i.orig.width*config.scale+'px'});
        html.find('.sizer').css({width: i.orig.width*config.scale+'px', height: i.orig.height*config.scale+'px', left:'1px', top:'1px'});
        let $sizer = html.find('.sizer')
        config = {...config, ...$sizer.position(), ...{width: $sizer.width(), height: $sizer.height()}}
      });
      */
      let $header  = c._element.find('header');

      $header.find('h4.window-title').after($(`<a title="Change Image" ><i class="fas fa-image"></i></a>`).click(async function(){
        return new FilePicker({
          title: "Select a new image",
          type: "image",
          displayMode: 'tiles',
          callback: async (path) => {
              i = await loadTexture(path);
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
              c.setPosition()
            }
          }).render(true);
      }));

      $header.find('h4.window-title').after($(`<a data-tooltip="Sheet Font"><i class="fas fa-font"></i></a>`).click(function(e){
        if ($(`#${name}-font-dialog`).length) return ui.windows[$(`div#${name}-font-dialog`).data().appid].bringToTop();
        new Dialog({
          title: `Font Configuration`,
          content: `
          ${(game.release?.generation < 10)?
            `<input type="text" class="fontFamily" placeholder="font name" style="width:100%">`:
            [...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%">`) + `</select>`
          }
          ${[...Array(10)].map((x,i)=>(i+1)*100).reduce((a,w)=>a+=`<option value="${w}" style="font-weight: ${w};">${w}</option>`,`<select class="fontWeight" style="width:100%">`)+`</select>`}
          ${[...Array(50)].map((x,i)=>Math.max((i+2)*2*2)).reduce((a,w)=>a+=`<option value="${w}">${w}px</option>`,`<select class="fontSize" style="width:100%">`)+`</select>`}
          <input class="fontColor" type="color" value="" style="border:unset; padding: 0; width: 100%">
          
          `,
          buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async ()=>{ 
            html.find('center > div').css({fontFamily: config.fontFamily, color: config.color, fontSize: config.fontSize}); }}},
          render: (html)=>{ 
            let $fontFamily = html.find('.fontFamily');
            let $fontWeight = html.find('.fontWeight');
            let $fontColor = html.find('.fontColor');
            let $fontSize = html.find('.fontSize');
            $fontFamily.val(config.fontFamily);
            $fontWeight.val(config.fontWeight);
            $fontColor.val(config.color);
            $fontSize.val(config.fontSize||16);
            
            $fontFamily.css('font-weight', $fontWeight.val());
            $fontFamily.css('font-family', $fontFamily.val());
            $fontWeight.css('font-weight', $fontWeight.val());
            $fontWeight.css('font-family', $fontFamily.val());
            
            $fontFamily.change(async function(){
              let fontFamily =  $(this).val();
              config.fontFamily = fontFamily;
              $(this).css({fontFamily});
              $(this).next().css({fontFamily});
            });
            
            $fontWeight.change(async function(){
              let fontWeight = $(this).val();
              config.fontWeight = fontWeight;
              $(this).css({fontWeight});
              $(this).prev().css({fontWeight});
            });

            $fontSize.change(async function(){
              let fontSize = Number($(this).val());
              config.fontSize = fontSize;
            });
  
            $fontColor.change(async function(){
              let color = $(this).val();
              config.color = color;
            });
          },
          close:(html)=>{ return }
        },{...$(this).offset(), width: 150, id: `${name}-font-dialog`}).render(true);
      }));

      $header.find('h4.window-title').after($(`<a data-tooltip="Scale +10%"><i class="fas fa-plus"></i></a>`).click( async function(e){
        config.scale += .1;
        html.find('img').css({width: i.orig.width*config.scale+'px'});
        html.find('.sizer').css({width: i.orig.width*config.scale+'px', height: i.orig.height*config.scale+'px', left:'1px', top:'1px'});
        config = {...config, ...html.find('.sizer').position(), height: html.find('.sizer').height(), width: html.find('.sizer').width()};
      }).dblclick(function(e){e.stopPropagation();}));
  
      $header.find('h4.window-title').after($(`<a class="zoom"  data-tooltip="Reset Scale"><b>Reset</b></a>`).click( async function(e) {
        config.scale = 1;
        html.find('img').css({width: i.orig.width*config.scale+'px'});
        html.find('.sizer').css({width: i.orig.width*config.scale+'px', height: i.orig.height*config.scale+'px', left:'1px', top:'1px'});
        config = {...config, ...html.find('.sizer').position(), height: html.find('.sizer').height(), width: html.find('.sizer').width()};
      }).dblclick(function(e){e.stopPropagation();}));
  
      $header.find('h4.window-title').after($(`<a data-tooltip="Scale -10%"><i class="fas fa-minus"></i></a>`).click( async function(e){
        config.scale -= .1;
        html.find('img').css({width: i.orig.width*config.scale+'px'});
        html.find('.sizer').css({width: i.orig.width*config.scale+'px', height: i.orig.height*config.scale+'px', left:'1px', top:'1px'});
        config = {...config, ...html.find('.sizer').position(), height: html.find('.sizer').height(), width: html.find('.sizer').width()};
      }).dblclick(function(e){e.stopPropagation();}));
      
      
    },
    close: async (html)=>{ return false;}
  }, {height: 'auto', width: 'auto', id: `${name}-ffs-configuration`}).render(true);
}

class ffsSettingsApp extends Dialog {
  
  constructor(data, options) {
    super(options);
    this.data = {
    title: `Freeform Sheets Configuration`,
    content: `<button class="add" style="margin-bottom: 1em;"><i class="fas fa-plus"></i>Add Sheet</button><center class="sheets"></center>`,
    render: async (html)=>{
      let d = this;
      html.find('.sheets').append($(Object.entries(game.settings.get('ffs', 'sheets')).reduce((a, [name, config])=> {
      return a+=`<div style="margin-bottom:.5em;"><h2>${name}<a class="delete" name="${name}" style="float:right"><i class="fas fa-times"></i></a></h2>
        <a class="configure" name="${name}" ><img src="${config.background}" height=300></a><br>
        <button class="template" name="${name}" style="width: 200px">${game.actors.find(a=>a.getFlag('ffs', name)?.template)?'Edit':'Create'} Template Actor</button>
        <button class="default" name="${name}" style="width: 200px">${(game.settings.get('ffs', 'defaultSheet') == name)?'Default':'Set Default'}</button>
        </div>
        `}	,``)));//
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
      html.find('button.default').click(async function(){
        await game.settings.set('ffs', 'defaultSheet', this.name);
        d.render(true);
      })
      html.find('button.add').click(async function(){
        let name = await Dialog.prompt({
          title:'Input sheet Name',
          content:`<input type="text" style="text-align: center;" autofocus></input>`, 
          callback:(html)=>{return html.find('input').val()}
        },{width:100});
        name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
        if (!name) return ui.notifications.warn('Sheets must have a name.');
        if (ffs.restirctedNames.includes(name)) return console.error("restricted name", name);
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
      html.find('button.template').click(async function(){
        let templateActor = game.actors.find(a=>a.getFlag('ffs', this.name)?.template)
        if (templateActor) {
          templateActor.freeformSheet(this.name);
        } else {
          let folder = game.folders.find(f=>f.getFlag('ffs', 'template'));
          if (!folder) folder = await Folder.create({type:'Actor', name: 'Freeform Sheet Templates', flags: {ffs: {template: true}}})
          Hooks.once('renderDialog', (app, html)=>{
            html.find('input[name="name"]').val(`${this.name} template`);
            html.find('select[name="folder"]').val(folder.id);
          });
          templateActor = await Actor.createDialog({name: `${this.name} template`, img: $(this).parent().find('img').attr('src')});
          if (!templateActor) return;
          await templateActor.setFlag('ffs', this.name, {template:true})
          await templateActor.update({folder: folder.id})
          templateActor.freeformSheet(this.name);
          $(this).text('Edit Template Actor');
        }
      });
    },
    buttons: {
      //confirm: {label:"Confirm", icon: '<i class="fas check"></i>', callback: async (html)=>{return}},
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
    return Object.values(ui.windows).find(app => app.id === "freeform-sheets-module-settings");
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
  constructor() { super({}); ffsSettingsApp.show({}); }
  async _updateObject(event, formData) {  }
  render() { this.close(); }
}

Hooks.once("init", async () => {

  game.settings.register("ffs", "sheets", {
    name: "Freeform Sheets",
    hint: "Configurations for Freeform Sheets",
    scope: "world",      
    config: false,       
    type: Object,
    default: {},         
    onChange: value => { 
      $('div[id^=ffs]').each(function(){
        ui.windows[$(this).data().appid].close();
      })
      ui.sidebar.tabs.actors.render(true);
    }
  });

  game.settings.registerMenu("ffs", "ffsConfigurationMenu", {
    name: "Freeform Sheets Configuration",
    label: "Configuration",      
    hint: "Configuration for Freeform Sheets",
    icon: "fas fa-bars",               
    type: SettingsShim,   
    restricted: true                   
  });
/*
  game.settings.register('ffs', 'overridePlayerCharacterSheet', {
    name: `Override Player's Actor Sheets`,
    hint: `Players will not be able to access the system character sheets and the default sheet will be shown instead.`,
    scope: "world",
    type: Boolean,
    default: false,
    config: true
  });

  game.settings.register('ffs', 'defaultSheet', {
    name: `Default Sheet`,
    hint: `Sheet to show on hotkey or from actor sheet header button.`,
    scope: "world",
    type: String,
    choices: Object.keys(game.settings.get('ffs', 'sheets')).reduce((a,k)=>{return a= {...a, [k]:k}},{default:""}),
    default: "default",
    config: true
  });
*/
  game.settings.register('ffs', 'invertSizing', {
    name: `Invert Sizing`,
    hint: `When enabled mouse wheel down will reduce text size rather than increase.`,
    scope: "client",
    type: Boolean,
    default: false,
    config: true
  });

});
/*
Hooks.on('renderActorSheet', (app, html, data)=>{
  if (!game.settings.get('ffs', 'overridePlayerCharacterSheet')) return;
  if (game.user.isGM) return;
  if (game.settings.get('ffs', 'defaultSheet')=="default") return ui.notifications.warn('No default sheet selected.')
  app.object.freeformSheet(game.settings.get('ffs', 'defaultSheet'))
  html.css({display:'none'})
  html.ready(function(){app.close()})
});
*/
Hooks.on('getActorSheetHeaderButtons', (app, buttons)=>{
  if (Object.keys(game.settings.get('ffs', 'sheets')).length)
  buttons.unshift({
    "label": "Freeform Sheet",
    "class": "ffs-sheet",
    "icon": "fas fa-file-alt",
    onclick: (e)=>{
      let defaultSheet = app.actor.get('ffs', 'defaultSheet');
      if (defaultSheet!='default') return app.actor.freeformSheet(defaultSheet)
      ffs.sheets(app.object, e);
    }
  })
})

Hooks.on('renderActorSheet', (app, html)=>{
  html.find('a.header-button.ffs-sheet').contextmenu(function(e){
    ffs.sheets(app.object, e);
  })
})

// add actor directory context menu options for each sheet

Hooks.on('getActorDirectoryEntryContext', (app, options)=>{
  for (let name of Object.keys(game.settings.get('ffs', 'sheets'))) {
    let templateActor = game.actors.find(a=>a.getFlag('ffs', name)?.template);
    /*
    options.push(
      {
        "name": `${name.capitalize()} Freeform Sheet`,
        "icon": `<i class="fas fa-file-alt"></i>`,
        "element": {},
        condition: li => {
          return true
        },
        callback: li => {
          const actor = game.actors.get(li.data("documentId"));
          actor.freeformSheet(name);
        }
      }
    );
    */
    if (templateActor && game.user.isGM) {
      options.push(
        {
          "name": `Apply ${name.capitalize()} Template`,
          "icon": `<i class="fas fa-download"></i>`,
          "element": {},
          condition: li => {
            return templateActor.id != li.data("documentId")
          },
          callback: async li => {
            const actor = game.actors.get(li.data("documentId"));
            let apply = await Dialog.prompt({
              title: `Confirm Apply Template`,
              content: `<center><p> This will apply all fields and configuration from ${templateActor.name} to actor ${actor.name}</p><center>`,
              callback:()=>{return true},
              close:()=>{return false}
            });
            if (!apply) return ui.notifications.info('Freeform Sheet template application aborted.');
            await ffs.clone(name, templateActor, actor) ;
            actor.freeformSheet(name);
            return ui.notifications.info(`Freeform Sheet '${name}' template from '${templateActor.name}' applyed to actor '${actor.name}.'`);
          }
        }
      );
    }
  }
});

Hooks.on('ready', ()=>{
  if (!game.user.isGM) return;
  if (Object.keys(game.settings.get('ffs', 'sheets')).length) return;
  let d = new Dialog({
    title:'Welcome to Freeform Sheets',
    content:`<center><p>You currently do not have any freeform sheets configured.<br>&nbsp;</p></center>
    <div style="display: flex;">
    <button class="config" style="width:50%;">Open Sheet Config</button>
    <button class="disable" style="width:50%;">Disable Module</button>
    </div>
    `,
    buttons:{},
    render:(html)=>{
      html.find('.config').click(async function(){
        d.close();
        new ffsSettingsApp().render(true);
      });
      
      html.find('.disable').click(async function(){
        let disable = await Dialog.prompt({title:`Disable Freeform Sheets?`,content:`<center><p>Foundry will reload.<br>&nbsp;</p></center>`, callback:(html)=>{return true}, rejectClose: false},{width:100});
        if (!disable) return false;
        let modules = game.settings.get("core", ModuleManagement.CONFIG_SETTING);
        modules.ffs = false;
        game.settings.set("core", ModuleManagement.CONFIG_SETTING, modules);
        game.socket.emit("reload");
        foundry.utils.debouncedReload();
        return;
    })
    },
    close:()=>{return;}
  }).render(true)
})
/*
Hooks.once('setup', function () {
  const { SHIFT, ALT, CONTROL } = KeyboardManager.MODIFIER_KEYS
  game.keybindings.register('ffs', 'open-freeform-sheet', {
    name: 'Open Default Sheet',
    hint: "Press to open the configured default sheet for the user's assigned character.",
    editable: [
      {
        key: 'KeyF',
      },
    ],
    reservedModifiers: [SHIFT, ALT, CONTROL],
    onDown: () => {  },
    onUp: () => { 
      let actor = game.user.character;
      if (canvas.tokens.controlled.length)
        actor = canvas.tokens.controlled[0]?.document?.actor;

      if (!actor) actor = game.user.character;
      if (!actor) return;
      if (game.settings.get('ffs', 'defaultSheet')=="default") return;
      actor.freeformSheet(game.settings.get('ffs', 'defaultSheet'))
     },
  })
})
*/

class defaultActorFFS extends ActorSheet {

  static get defaultOptions() {
    const _default = super.defaultOptions;

    return {
      ..._default,
      classes: ['hidden', 'sheet', 'actor', 'ffs-dummy', 'form']
    };
  }
  render() {
    let defaultSheet = this.actor.getFlag('ffs', 'defaultSheet') //game.settings.get('ffs', 'defaultSheet');
    if (!defaultSheet) return new DocumentSheetConfig(game.user.character).render(true)
    this.actor.freeformSheet(defaultSheet)
    this.close()
  }

}

Hooks.once('ready', function () {
  Actors.registerSheet('ffs', defaultActorFFS);
})

Hooks.on('renderDocumentSheetConfig', async (app, html)=>{
  console.log(app.object.documentName)
  if (app.object.documentName != 'Actor') return;
  let sheets = Object.keys(game.settings.get('ffs', 'sheets'))
  if (sheets.length == 0) return
  let defaultSheet = app.object.getFlag('ffs', 'defaultSheet')
  if (!defaultSheet) {
    defaultSheet = sheets[0]
    await app.object.setFlag('ffs', 'defaultSheet', defaultSheet)
  }
  let select = $(`<select>${sheets.reduce((a,k)=> a+=`<option value="${k}">${k}</option>`,``)}</select>`)
  select.val(defaultSheet)
  select.change(function(){
    app.object.setFlag('ffs', 'defaultSheet', this.value)
  })
  let group = $(`<div class="form-group">
        <label>Freeform Sheet</label>
        
        <p class="notes">Which sheet to open when ffs.defaultActorFFS is selected.</p>
    </div>`)
  group.find('label').after(select)
  html.find('button').before(group)
  app.setPosition({height: 'auto'})
})