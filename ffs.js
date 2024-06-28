var ffs = {};

/**  
 * @param {string} name name given to the sheet in the module configuration. all text and config on the sheet will be stored under in the actor's ffs.name flag
*/
ffs.freeformSheet = async function(name) {
  let doc = this;
  if (doc.permission<2) return ui.notifications.warn(`You do not have adequate permissions to view this ${doc.documentName}'s sheet`)
  name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
  
  //console.log(`Rendering Freeform Sheet ${name} for ${doc.name}`)

  if (ffs.restirctedNames.includes(name)) return console.error("restricted name", name);
  let sheet = game.settings.get('ffs', 'sheets')[name];
  if (!sheet) return console.error(`sheet config for ${name} not found in game settings`);;
  let id = `ffs-${name}-${doc.id}`;
  
  if ($(`div#${id}`).length) 
    return ui.windows[$(`div#${id}`).data().appid].close()//render(true).bringToTop();
  
  if (!doc.getFlag('ffs', name)) 
    await doc.setFlag('ffs', [name], {})
  if (!doc.getFlag('ffs', name)?.config)
    await doc.setFlag('ffs', [name], {config: {scale: 1, filter: '', showContentImages: false, showContentIcons: false, showContentText: true}});

  let zUpdates = Object.entries(doc.getFlag('ffs', name)).filter(([k,v])=>v?.z).sort(([ak,av],[bk,bv])=>av.z-bv.z).map(([k,v],i)=>{return [k,{z:i+1}]}).reduce((a,[k,v])=> { a[k]=v; return a}, {})

  await doc.setFlag('ffs', name, zUpdates)
  // perform cleanup of empty and NEW TEXT. Should not be necessary
  /*
  for (const [key, value] of Object.entries(doc.getFlag('ffs', name))) {
    if (ffs.restirctedNames.includes(key)) continue;
    if (value.text.includes('img')) continue;
    if (!value.text || ($(`<span>${value.text}</span>`).text()=='') || value.text=='NEW TEXT') 
      await doc.unsetFlag('ffs', `${name}.${key}`)
  }
  */
  ffs[id] = {...ffs[id], ...sheet, ...doc.getFlag('ffs',`${name}.config`)};

  if (!ffs[id].hasOwnProperty('showContentImages')) ffs[id].showContentImages = false;
  if (!ffs[id].hasOwnProperty('showContentIcons')) ffs[id].showContentIcons = false;
  if (!ffs[id].hasOwnProperty('showContentText')) ffs[id].showContentText = true;
  
  let options = {width: 'auto', height: 'auto', id}
  if (ffs[id].position) options = {...options, ...ffs[id].position}

  let formatText = async function(text) {
    const charaData = game.release?.generation >= 10 ? doc.system : doc.data.data;
    const flags = game.release?.generation >= 10 ? doc.flags : doc.data.flags;
    const rollData = {...charaData, ...doc.getRollData(), flags, name: doc.name, id: doc.id, uuid: doc.uuid};
    text = await TextEditor.enrichHTML(text, {async:true, rolls:true, rollData});
    return Roll.replaceFormulaData(text, rollData, {missing: 0});
  }
//TextEditor.enrichHTML(text, {async:true, secrets:false, documents:false, links:false, rolls:true})
  let newSpan = async function(key, value){
    let updateFlagDebounce = foundry.utils.debounce((doc, name, key, update)=> {
      doc.setFlag('ffs', [`${name}.${key}`], update) 
      $('.font-tooltip').remove();
    }, 500);
    if (value.text==undefined) return await doc.unsetFlag('ffs', `${name}.${key}`);
    let cursor = 'text';
    let match = value.text.match(/@([a-z.0-9_\-]+)/gi);
    if (match) {
      text = match[0];
      text = text.replace('@', '');
      if (game.release.generation > 11) {
        if (doc.system.schema.getField(text)) cursor = 'pointer';
      }
      else {
        if (!foundry.utils.hasProperty(game.system.model[doc.documentName][doc.type], text)) cursor = 'pointer';
      }
      if (game.system.id=='worldbuilding' && foundry.utils.hasProperty(game.release?.generation>=10?doc.system:doc.data.data, value.text)) cursor = 'pointer';
    }
    let $span = $(`<span id="text-${key}" style="cursor: ${cursor}; position: absolute; ${value.z?'z-index:'+value.z:''}">${await formatText(value.text)}<span>`);
    $span.css({left: value.x+'px', top: value.y+'px', fontSize: value.fontSize})
    let click = {x: 0, y: 0};
    $span
    .focusout(async function(){
      $(this).find('span').remove();
      let input = $(this).html().trim();
      if (input == "" || input == "NEW TEXT") {
        await doc.unsetFlag('ffs', `${name}.${key}`);
        return $(this).remove();
      }
      $(this).html(await formatText(input))
      await doc.setFlag('ffs', [`${name}.${key}`], {text: input});
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
      return;
      //console.log($(this).prop('contenteditable'))
      if ($(this).prop('contenteditable')) return;
      let selection = window.getSelection();
      let range = document.createRange();
      range.selectNodeContents(this);
      selection.removeAllRanges();
      selection.addRange(range);
      $(this).draggable('disable');
    })
    .on("wheel", async function(e) {
      if ($(this).parent().hasClass('locked')) return;
      let fontSize = parseInt($(this).css('font-size'))
      let change = 1;
      
      if (e.ctrlKey) {
        let z = Number(this.style.zIndex)
        if (e.originalEvent.wheelDelta<0) 
          if (e.shiftKey) z+= 5
          else z++
        else 
          if (e.shiftKey) z-= 5
          else z--
        if (z<0) z = 0
        $(this).css({'z-index': z});
        updateFlagDebounce(doc, name, key, {z});
        $('.font-tooltip').remove();
        $('body').append($(`<span class="font-tooltip" style="position: absolute; top: ${e.clientY-10}px; left: ${e.clientX+10}px; pointer-events: none; color: white; background: #000; border: 1px solid white; padding:2px; z-index:1000;">z-index: ${z}</span>`));
      
        return
      }
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
      updateFlagDebounce(doc, name, key, {fontSize, y});
    })
    .on('copy', function(e){
      let selection = window.getSelection();
      e.originalEvent.clipboardData.setData('text/plain', selection.toString());
      e.preventDefault();
    })
    .draggable({
      start: function(e){
        $(this).css('pointer-events', 'none')
        e.stopPropagation()
        //e.preventDefault()
        $(this).parent().css('cursor', 'grabbing');
        click.x = e.clientX;
        click.y = e.clientY;
        let z = Object.entries(doc.getFlag('ffs', name)).filter(([k,v])=>v.z && k!=key).map(([k,v])=>v.z).sort((a,b)=>b-a).at(0) ?? 1
        z++
        doc.setFlag('ffs', [`${name}.${key}.z`], z);
        $(this).css({'z-index': z});
      },
      drag: function(e, data) {
        event.stopPropagation();
        let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0]);
        let appScale = Number($(this).closest('.app').css('transform').split('matrix(')[1]?.split(',')[0]);
        if (appScale) scale *= appScale;
        let original = data.originalPosition;
        data.position = {
          left: Math.round((e.clientX-click.x+original.left)/scale),
          top:  Math.round((e.clientY-click.y+original.top )/scale)
        };
        //$(this).parent().css('cursor', 'grabbing');
      },
      stop: async function(e, data){
        e.stopPropagation()
        //e.preventDefault()
        let appScale = Number($(this).closest('.app').css('transform').split('matrix(')[1]?.split(',')[0]);
        let scale = Number($(this).parent().css('transform').split('matrix(')[1].split(',')[0]);
        if (appScale) scale *= appScale;
        data.position = {
          left: Math.round((e.clientX-click.x+data.originalPosition.left)/scale),
          top:  Math.round((e.clientY-click.y+data.originalPosition.top )/scale)
        };
        //console.log(z)
        await doc.setFlag('ffs', [`${name}.${key}`], {x: data.position.left, y: data.position.top});
        $(this).css('pointer-events', 'all')
        $(this).parent()[0].style.cursor=null//.css({cursor:null})
        //$(this).parent().append(this)
      }
    })
    .contextmenu(function(e){
      e.stopPropagation();
      e.preventDefault();
      if ($(this).parent().hasClass('locked')) return;
      let span = doc.getFlag('ffs', name)[key];
      let text = span.text;
      if ((e.ctrlKey || text.includes('@') || text.includes('[[') || (text.includes('<') && text.includes('>'))) && !e.shiftKey) {
        let w = $(`#value-${id}-${key}`)
        if (w.length) return ui.windows[w.data().appid].bringToTop()
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
              //console.log(`removing span`, name, key)
              await doc.unsetFlag('ffs', `${name}.${key}`);
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
            await doc.setFlag('ffs', `${name}.${key}`, {text: input});
          }},
          cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
          default: 'confirm',
          render: (html)=>{
            $(html[0]).append(`<style>#${valueDialog.id}{min-width:400px; height:auto !important; width:auto !important;}</style>`);
            html.find('textarea').val(text);
            html.find('textarea').select();
            html.parent().parent() 
            .mouseenter(function(){$(`span#text-${key}`).css({'outline': 'red solid 2px'})})
            .mouseleave(function(){$(`span#text-${key}`).css({'outline': ''})})
            //function buildObjectElements(rollData, el, objectPath) {
            //let property = getProperty(rollData, objectPath)
            function buildObjectElements(el, objectPath) {
              let property = getProperty(doc, objectPath)
              if (property.documentName) return;
              if (property===null) return;
              for (let key of Object.keys(property)) {
                let prop = foundry.utils.getProperty(doc, `${objectPath}.${key}`)
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
              //rollData.system = doc.getRollData();
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
            $(`span#text-${key}`).css({'outline': ''})
            return $('body').find('.object-path-root').remove();
          }
        },{...options, id: `value-${id}-${key}`}).render(true)

        return;
      }
      $(this).html(text);
      $(this).prop('role',"textbox")
      $(this).prop('contenteditable',"true") // TEST
      let selection = window.getSelection();
      let range = document.createRange();
      range.selectNodeContents(this);
      selection.removeAllRanges();
      selection.addRange(range);
      //$(this).trigger('focusin');//focus()
    })
    .dblclick(function(e){
      let text = doc.getFlag('ffs', name)[key].text;
      let match = text.match(/@([a-z.0-9_\-]+)/gi);
      if (!match) return; 
      match.findSplice(i=>i=='@UUID')
      text = match[0];
      text = text.replace('@', '');
      
      let model = game.release.generation < 12 ? game.system.model : game.model

      if (foundry.utils.hasProperty(model[doc.documentName][doc.type], text) || 
          (game.system.id=='worldbuilding' && foundry.utils.hasProperty(doc.system, text)) ||
         (game.release.generation > 11) && doc.system.schema.getField(text)) {
        let val = foundry.utils.getProperty(game.release?.generation>=10?doc.system:doc.data.data, text);
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
            await doc.update({[`${(game.release?.generation >= 10)?'system':'data'}.${text}`]: input});
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
        let val = foundry.utils.getProperty(doc, text);
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
            await doc.update({"name": input});
          }}},
          default: 'confirm',
          render: (html) =>{
            html.find('input').select();
          },
          close: ()=>{ return
          }
        },{...options, id: `${id}-${key}-value-dialog`}).render(true);
      }
      if (foundry.utils.hasProperty({flags:doc.flags}, text)) {
        let flag = text.split('.');
        flag.shift();
        let scope = flag.shift();
        let prop = flag.join('.');
        let val = doc.getFlag(scope, prop);
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
            await doc.setFlag(scope, prop, input);
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
  let rendered = false
  let d = new Dialog({
    title: `${doc.name}`,
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
      for (const [key, value] of Object.entries(doc.getFlag('ffs', name))) 
        if (ffs.restirctedNames.includes(key)) continue;
        else $sheet.append(await newSpan(key, value));
      
      // apply sheet events for creating new spans
      
      $sheet.contextmenu(async function(e){
        if (locked) return;
        if (!!e?.originalEvent && e?.originalEvent?.target.nodeName != "DIV") return;
        let id = randomID();
        let z = Object.entries(doc.getFlag('ffs', name)).filter(([k,v])=>v.z).map(([k,v])=>v.z).sort((a,b)=>b-a).at(0) ?? 1
        z++
        let value = {x: e.offsetX, y: e.offsetY-8, text: e.ctrlKey?"@":"NEW TEXT", fontSize: fontSize || 16, z};
        await doc.setFlag('ffs', [`${name}`], {[`${id}`]: value});
        let $span = await newSpan(id, value);
        $(this).append($span);
        $span.contextmenu();
      })
      .on('drop', async function(e){
        if (locked) return;
        e.originalEvent.preventDefault();
        let data;
        let text = e.originalEvent.dataTransfer.getData("Text");
        //console.log(text)
        try{data = JSON.parse(text);}catch(e){}
        if (typeof data == 'object' && data.type!= "Tile")
          if (game.release?.generation >= 10) text = fromUuidSync(data.uuid).link
          else text = CONFIG[data.type].collection.instance.get(data.id).link
        if (typeof data == 'object' && data.type== "Tile")
          text = `<img src="${data.texture.src}">`
        if (!text) return;
        let id = randomID();
        let value = {x: e.offsetX, y: e.offsetY-8, text, fontSize: fontSize};
        await doc.setFlag('ffs', [`${name}`], {[`${id}`]: value});
        let $span = await newSpan(id, value);
        $(this).append($span);
      })

      if (locked) html.find(`.ffs > span`).draggable('disable')
      if (rendered) return
      rendered = true
      d.addHeaderButtons(d, html, options)
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
    Hooks.on(`update${this.documentName}`, async (updated, updates, context, userId)=>{
      //console.log(updates);
      if (updated.id!=doc.id) return;
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
            return $sheet.find(`span#text-${key}`).remove();
          }
          $sheet.find(`span#text-${key}`).remove();
          let value = updated.flags.ffs[name][key];
          $sheet.append(await newSpan(key, value));
        }
        return;
      }
      for (let [key, value] of Object.entries(updated.getFlag('ffs', name)).filter(([id, span])=>span.text?.includes('@'))) {
        let $sheet = d.element.find('div.ffs');
        $sheet.find(`span#text-${key}`).remove();
        let value = updated.flags.ffs[name][key];
        $sheet.append(await newSpan(key, value));
      }
        //d.element.find(`span#${spanId}`).html(await formatText(span.text)).find('img').height(span.fontSize);
    });

  //let waitRender = 100; if (!d._element)  while (!d._element  && waitRender-- > 0) await new Promise((r) => setTimeout(r, 50));
  //Hooks.once('renderDialog',(app, html, options)=>{
  d.addHeaderButtons = function(app, html, options){
    // set header buttons
    html = html.closest('.app')
    //console.log('addHeaderButtons', html)
    app.object=doc;
    app[doc.documentName.toLowerCase()] = doc
    html.closest('.dialog').addClass('sheet')
    let $header  = html.find('header');
    //if (game.user.isGM)
    $header.find('h4.window-title').after($(`<a data-tooltip="Sheet"><i class="fas fa-cog"></i></a>`).click(function(e){
      //if (e.ctrlKey) return ffs.configure(name) ${game.user.isGM?'<br>Ctrl+Click FFS Config':''}
     
      new DocumentSheetConfig(doc).render(true,{
      top: $(this).offset().top+30,
      left: e.clientX - 200
    })
    }));
    // to remember last position  
    html.click(function(){if (app._element) ffs[id].position = app._element.offset(); })
    $header.find('h4.window-title').after($(`<a  class="ffs-tool" data-tooltip="Data"><i class="fa-solid fa-at"></i></a>`).click(function(){
      // This will create a dialog to find fields to use on your actor freeform sheet 
      // You can drag fields from thid dialog directly to the sheet
      // Great for templating complex systems
      
      function buildObjectElements(el, objectPath) {
        let property = getProperty(doc, objectPath)
        if (property.documentName) return;
        if (property===null) return;
        for (let key of Object.keys(property)) {
          let prop = foundry.utils.getProperty(doc, `${objectPath}.${key}`)
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
              <span>${key} : </span><a draggable="true">${typeof(prop)=="string"?`"${prop}"`:prop}</a>
            </div>`));
        }
        return el;
      }
      
      let fieldsDialog = new Dialog({title: doc.name + ' Data', content: '', buttons:{}, render: (html)=> {
        let $atOptions = $(`<div class="a-object-path-root" data-path="system" 
        style="width: max-content; height: max-content; "><a></a></div>`)
        buildObjectElements($atOptions, `${(game.release?.generation >= 10)?'system':'data.data'}`)
        $atOptions.find(`.object-path, .value-path`).hide()
        $atOptions.children(`.object-path, .value-path`).show()
        $atOptions.find('[draggable=true]')
          .on('dragstart', function(e){
            e.originalEvent.dataTransfer.setData("text/plain", '@'+$(this).parent().data().path.replace('system.','').replace('data.data.', ''))})
          .css('cursor', 'grab')
        $atOptions.find(`a`).click(function(){
          $(this).parent().children('div').toggle()
          fieldsDialog.setPosition({height: 'auto'})
        })
        $atOptions.find(`.value-path > a`).click(function(){
          //console.log('@'+$(this).parent().data().path.replace('system.','').replace('data.data.', ''))
          fieldsDialog.setPosition({height: 'auto'})
        })
        
        $(html[0]).append($atOptions)
        
      }},{height: 'auto', width: 200, left: app.position.left+app.position.width, top: app.position.top, resizable: true}).render(true)
    }))
    
    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Fix Sheet"><i class="fas fa-tools"></i>`).click(function(e){
      let sheet = doc.getFlag('ffs', name)
      let content = '';
      for (const [key, value] of Object.entries(sheet)) {
        if (ffs.restirctedNames.includes(key)) continue;
        content += `<div class="span" data-id="${key}"><label>${key} {x:${value.x}, y:${value.y}, fontSize: ${value.fontSize}}
        <a data-id="${key}" style="float:right; margin: 0 .2em;" class="delete">Delete</a>
        <a data-id="${key}" style="float:right; margin: 0 .2em;" class="save">Save</a></label><textarea id="textarea-${key}"></textarea><hr></div>`
      }
      let d = new Dialog({
          title:`Fix FFS - ${name} - ${doc.name} `,
          content,
          buttons:{},
          render:(html)=>{
            html.find('div.span')
              .mouseenter(function(){$(`#text-${this.dataset.id}`).css({'outline': 'red solid 2px'})})
              .mouseleave(function(){$(`#text-${this.dataset.id}`).css({'outline': ''})})
            $(html[0]).append(`<style>#${d.id}{ height:auto !important;}</style>`);
            for (const [key, value] of Object.entries(sheet)) {
              if (ffs.restirctedNames.includes(key)) continue;
              html.find(`textarea#textarea-${key}`).val(value.text)
            }
            html.find('a.save').click(async function(e){
              await doc.setFlag('ffs', `${name}.${this.dataset.id}.text`, $(this).parent().next().val())
              ui.windows[$(`#ffs-${name}-${doc.id}`).data().appid].render(true)
            })
            html.find('a.delete').click(async function(e){
              await doc.unsetFlag('ffs', `${name}.${this.dataset.id}`)
              $(this).parent().parent().remove();
              ui.windows[$(`#ffs-${name}-${doc.id}`).data().appid].render(true)
            })
          },
        close:()=>{$(`span[id^="text-"]`).css({'outline': ''})}
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
          `<input type="text" class="fontFamily" placeholder="font name" style="width:100%">`:(game.release?.generation > 11)?
          [...Object.keys(game.settings.get('core', 'fonts')), ...Object.keys(CONFIG.fontDefinitions)].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%"  data-tooltip="Font Family">`):
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
            await doc.setFlag('ffs', name, {config: {fontFamily}});
            d.render(true);
          });
          
          $fontWeight.change(async function(){
            let fontWeight = $(this).val();
            ffs[id].fontWeight = fontWeight;
            $(this).css({fontWeight});
            $(this).prev().css({fontWeight});
            await doc.setFlag('ffs', name, {config: {fontWeight}});
            d.render(true);
          });
    
          $fontSize.change(async function(){
            let fontSize = Number($(this).val());
            ffs[id].fontSize = fontSize;
            await doc.setFlag('ffs', name, {config: {fontSize}});
            d.render(true);
          });
    
          $fontColor.change(async function(){
            let color = $(this).val();
            ffs[id].color = color;
            await doc.setFlag('ffs', name, {config: {color}})
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
            await doc.setFlag('ffs', name, {config: {showContentIcons}});
            d.render(true);
          }).prop('checked', ffs[id].showContentIcons);
    
          html.find('input.image').change(async function(){
            let showContentImages = $(this).is(':checked');
            ffs[id].showContentImages = showContentImages;
            await doc.setFlag('ffs', name, {config: {showContentImages}});
            d.render(true);
          }).prop('checked', ffs[id].showContentImages);
    
          html.find('input.text').change(async function(){
            let showContentText = $(this).is(':checked');
            ffs[id].showContentText = showContentText;
            await doc.setFlag('ffs', name, {config: {showContentText}});
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
      await doc.setFlag('ffs', name, {config: {hideContextIcons}});
      d.render(true);
    })*/
    
    
    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Sheet Filter"><i class="fas fa-eye"></i></a>`).click( async function(e){
      if ($(`#${id}-filter-dialog`).length) return ui.windows[$(`div#${id}-filter-dialog`).data().appid].bringToTop();
      e.stopPropagation();
      let confirm = false;
      let values = doc.getFlag('ffs', name).config.filter.split('%').map(f=>f.split('(')).map((f,i)=>!i?f:[f[0].split(' ')[1], f[1]]).reduce((a,f)=>{ return {...a, [f[0]]: f[1]}; },{})
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
            await doc.setFlag('ffs', [name], {config: {filter}});
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
          if (doc.getFlag('ffs', name).config.filter) 
              $(`#${id}`).find('.ffs > img.background').css({filter: doc.getFlag('ffs', name).config.filter});
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
      await doc.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));
    
    $header.find('h4.window-title').after($(`<a class="zoom ffs-tool"  data-tooltip="Reset Scale"><b>${Math.round(ffs[id].scale*100)}%</b></a>`).click( async function(e) {
      let {scale, width, height} = ffs[id];
      scale = 1;
      ffs[id].scale = 1;
      $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
      await doc.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));
    
    $header.find('h4.window-title').after($(`<a class="ffs-tool" data-tooltip="Scale -10%"><i class="fas fa-minus"></i></a>`).click( async function(e){
      e.stopPropagation();
      let {scale, width, height} = ffs[id];
      scale -= .1;
      scale = Math.round(scale*10)/10;
      ffs[id].scale = scale;
      $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
      await doc.setFlag('ffs', name, {config: {scale}})
      d.render(true)
    }).dblclick(function(e){e.stopPropagation();}));
    
    $header.find('h4.window-title').after($(`<a class="ffs-tool lock-toggle"><i class="fas fa-lock${ffs[id].locked?'':'-open'}"></i></a>`).click( async function(e){
      let locked = !ffs[id].locked;
      if (!locked) {
        $(`#${id}`).find('a.lock-toggle').attr('data-tooltip', "Lock Sheet")
        $(`#${id}`).find('a.lock-toggle > i').removeClass('fa-lock').addClass('fa-lock-open')
        $(`#${id}`).find(`.ffs`).removeClass('locked')
      }
      else {
        $(`#${id}`).find('a.lock-toggle').attr('data-tooltip', "Unlock Sheet")
        $(`#${id}`).find('a.lock-toggle > i').removeClass('fa-lock-open').addClass('fa-lock')
        $(`#${id}`).find(`.ffs`).addClass('locked')
      }
      ffs[id].locked = locked;
      await doc.setFlag('ffs', name, {config: {locked}})
      d.render(true);
      
    }).dblclick(function(e){e.stopPropagation();}));
    //console.log(html.find('a.lock-toggle'))
    if (ffs[id].locked) html.find('a.lock-toggle').attr('data-tooltip', "Unlock Sheet")
    else html.find('a.lock-toggle').attr('data-tooltip', "Lock Sheet")
    let buttons = []
    const canConfigure = game.user.isGM || (doc.actor?.isOwner && game.user.can("TOKEN_CONFIGURE"));
    if (canConfigure && doc.documentName=="Actor") {
      buttons.splice(1, 0, {
        label: d.token ? "Token" : "Proto Token",
        class: "configure-token",
        icon: "fas fa-user-circle",
        onclick: ev => {
          ev.preventDefault();
          const renderOptions = {
            left: Math.max(d.position.left - 560 - 10, 10),
            top: d.position.top
          };
          if ( d.token ) return doc.token.sheet.render(true, renderOptions);
          else new CONFIG.Token.prototypeSheetClass(d.actor.prototypeToken, renderOptions).render(true);
        }
      });
    }
    Hooks.call(`get${doc.documentName}SheetHeaderButtons`, d, buttons);
    //console.log(buttons)
    for (let button of buttons) 
      $header.find('h4.window-title').after($(`<a class="ffs-tool ${button.class}" data-tooltip="${button.label}"><i class="${button.icon}"></i></a>`).click(button.onclick))
    
    
    $header.find('a.ffs-tool').hide()
    $header.find('a[data-tooltip=Sheet]').before($(`<a><i class="fas fa-ellipsis fa-rotate-90"></a>`).click(function(e){
      $('body').find('.ffs-header-context').remove();
      let $tools = $(`<div class="ffs-header-context" data-path="system" 
      style="z-index: 1000; width: max-content; height: max-content; color: white; border: 1px solid black; box-shadow: 0 0 20px var(--color-shadow-dark);
      background: url(../ui/denim075.png) repeat; border-radius: 5px; padding: .5em; padding-left: -10px;
      position: absolute; left:${e.clientX-10}px; top:${e.clientY}px;">
      </div>`)
      .mouseenter(function(e){
        $(this).removeClass('hide');
      })
      .mouseleave(async function(e){
        $(this).addClass('hide');
        await new Promise((r) => setTimeout(r, 750));
        if ($(this).hasClass('hide'))
          $(this).remove();
      })
      $header.find('a.ffs-tool').each(function(){
        let t = $(this).clone(true)
        t.show()
        t.click(function(){t.parent().remove()})
        t.find('b').replaceWith(`<i class="fas fa-0">`)
        t.find('i').css({width:'1.5em', marginRight: '.2em', textAlign:'center'})
        t.append(this.dataset.tooltip)
        delete t[0].dataset.tooltip
        t.append($('<br>'))
        $tools.append(t)
      })
      $('body').append($tools)
    }).contextmenu(function(){$(`#${id}`).find('a.ffs-tool').toggle()}))
    //add document id thingy
    if ( !(this.object instanceof foundry.abstract.Document) || !this.object.id ) return;
    const title = html.find(".window-title");
    const label = game.i18n.localize(this.object.constructor.metadata.label);
    const idLink = document.createElement("a");
    idLink.classList.add("document-id-link");
    idLink.setAttribute("alt", "Copy document id");
    idLink.dataset.tooltip = `${label}: ${this.object.id}`;
    idLink.dataset.tooltipDirection = "UP";
    idLink.innerHTML = '<i class="fa-solid fa-passport"></i>';
    idLink.addEventListener("click", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.object.id);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {label, type: "id", id: this.object.id}));
    });
    idLink.addEventListener("contextmenu", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.object.uuid);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {label, type: "uuid", id: this.object.uuid}));
    });
    title.append(idLink);
    //$header.find('.ffs-tool').hide(); $header.mouseenter(function(){$(this).find('.ffs-tool').show()}).mouseleave(function(){$(this).find('.ffs-tool').hide()})
    /*
    if (Object.keys(game.settings.get('ffs', 'sheets')).length>1)
    $header.find('h4.window-title').before($(`<a title="Sheets" style="margin: 0 .5em 0 0;"><i class="fas fa-file-alt"></i></a>`).click( async function(e){
      ffs.sheets(doc, e);
    }).dblclick(function(e){e.stopPropagation();}));*/
  } // end addHeaderButtons
  d.render(true);
  return d;
}

Actor.prototype.freeformSheet = ffs.freeformSheet;
Item.prototype.freeformSheet = ffs.freeformSheet;

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
        <button class="configure" name="${name}"  style="width: 200px">Configure</button><br>
        <select class="document" name="${name}" style="width: 200px; text-align: center"><br>
          <option value="Actor" ${config.document=="Actor"?'selected':''}>Actor</option>
          <option value="Item" ${config.document=="Item"?'selected':''}>Item</option>
        </select>
        
        <button class="template" name="${name}" style="width: 200px">Template</button>
        </div>
        `}	,``)));//<button class="default" name="${name}" style="width: 200px">${(game.settings.get('ffs', 'defaultSheet') == name)?'Default':'Set Default'}</button>
      /*${
          config.document?(game[config.document.toLowerCase()+'s'].find(a=>a.getFlag('ffs', name)?.template)?'Edit':'Create'):
          (game['actors'].find(a=>a.getFlag('ffs', name)?.template)?'Edit':'Create')
          } */
      d.setPosition({height: 'auto'});
      html.find('.configure').click(function(){ffs.configure(this.name);});
      html.find('a.delete').click(async function(){
        let del = await Dialog.prompt({title:`Delete sheet ${this.name}?`,content:``, callback:(html)=>{return true}, rejectClose: false},{width:100});
        if (!del) return;
        let sheets = foundry.utils.deepClone(game.settings.get('ffs', 'sheets'));
        delete sheets[this.name];
        await game.settings.set('ffs', 'sheets', sheets);
        d.render(true);
      });/*
      html.find('button.default').click(async function(){
        await game.settings.set('ffs', 'defaultSheet', this.name);
        d.render(true);
      })*/
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
              let config = {background: path, width: i.orig.width, height: i.orig.height, left: 1, top: 1, document:'Actor'};
              let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: config}};
              await game.settings.set('ffs', 'sheets', sheets);
              ffs.configure(name);
              d.render(true);
            }
        }).render(true);
        
      })
      html.find('button.template').click(async function(){
        let sheets = game.settings.get('ffs', 'sheets')
        let name = this.name
        let docType = sheets[name].document ??"Actor"
        let model = game.release.generation < 12 ? game.system.model : game.model
        let type = await Dialog.prompt({
            title: 'Select Actor Type', 
            content: Object.keys(model[docType]).reduce((a,x)=>a+=`<button class="type">${x}</button>`,``),
            callback:(html)=>  html.find(`button.selected`).text(),
            render: (html)=>{
              $(html[2]).hide()
              $(html).find('button.type').click(function(){
                $(this).addClass('selected')
                $(html).find('button.ok').click()
              })
            }
          })
        if (!type) return;
        let template = game[docType.toLowerCase()+'s'].find(x=>x.getFlag('ffs', this.name)?.template && x.type==type)
        if (template) {
          await template.setFlag('ffs', 'defaultSheet', this.name)
          await template.setFlag('core', 'sheetClass', docType=='Actor'? "ffs.defaultActorFFS":"ffs.defaultItemFFS")
          template.freeformSheet(this.name);
        } else {
          let folder = game.folders.find(f=>f.getFlag('ffs', 'template') && f.type==docType);
          if (!folder) folder = await Folder.create({type:docType, name: 'Freeform Sheet Templates', flags: {ffs: {template: true}}})
          template = await game[docType.toLowerCase()+'s'].documentClass.create({
            name: `${this.name} ${type} template`, 
            type, 
            img: $(this).parent().find('img').attr('src'),
            folder: folder.id
          });
          
          if (!template) return;
          await template.setFlag('ffs', this.name, {template:true})
          await template.setFlag('ffs', 'defaultSheet', this.name)
          await template.setFlag('core', 'sheetClass', docType=='Actor'? "ffs.defaultActorFFS":"ffs.defaultItemFFS")
          template.freeformSheet(this.name);
        }
      });
      html.find('select.document').change(async function(){
        let sheets = game.settings.get('ffs', 'sheets')
        let name = this.name
        sheets[this.name].document = this.value
        game.settings.set('ffs', 'sheets', sheets)
      })
      html.find('button.document').click(async function(){
        let sheets = game.settings.get('ffs', 'sheets')
        let name = this.name
        //sheets[this.name].document = this.innerText!='Item'?'Item':'Actor'
        //game.settings.set('ffs', 'sheets', sheets)
        //d.render(true)
        //sheets[this.name].document = this.innerText!='Item'?'Item':'Actor'
        //game.settings.set('ffs', 'sheets', sheets)
        let docType = sheets[name].document ?? 'Actor'
        let model = game.release.generation < 12 ? game.system.model : game.model
        let docDialog =  new Dialog({
          title: `Configure ${name} sheet`, 
          content: `<label style="line-height: var(--form-field-height);">Document Type: </label>
          <select class="document" >
            <option value="Actor">Actor</option>
            <option value="Item">Item</option>
          </select><hr>`,
          render: (html)=>{
            //console.log(sheets[name])
            html.find('select.document').val(docType)
            let table = `<style>div.types-form span {line-height: var(--form-field-height);}</style>
            <div class="types-form" style="display:grid; grid-template-columns:max-content max-content auto ; column-gap: 1em; row-gap: .2em; margin-bottom: .5em">
            <b>available</b><b>default</b><b>type</b>
            ${Object.keys(model[docType]).reduce((a,x)=>a+=`
            <input name="${x}" class="available" type="checkbox" ${sheets[name].types?.includes(x)?'checked':''}></input>
            <input name="${x}" class="default" type="checkbox" ${sheets[name].defaults?.includes(x)?'checked':''}></input>
            <span>${x}</span>`,``)}</div>`
            html.find('hr').after(table)
            html.find('select.document').change(async function(){ 
              sheets[name].document = this.value
              await game.settings.set('ffs', 'sheets', sheets)
              sheets = game.settings.get('ffs', 'sheets')
              docType = this.value
              docDialog.render(true) 
            })
            
            docDialog.setPosition({height:'auto'})
          },
          buttons: { 
            ok: {
              icon: '<i class="fas fa-check"></i>',
              callback: (html)=>{
                sheets[name].document = html.find('select.document').val()
                sheets[name].types = [...html.find('input.available:checked')].map(e=> e.getAttribute('name'))
                sheets[name].defaults = [...html.find('input.default:checked')].map(e=> e.getAttribute('name'))
                //console.log(sheets[name])
                game.settings.set('ffs', 'sheets', sheets)
              }
            }
          }
          },{width: 300}).render(true)
        //return d.render(true)
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
      new this(options, {}).render(true, { focus: true });
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
      ui.windows[$('#client-settings').data()?.appid]?.render(true)
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
    hint: `Players will not be able to access the system actor sheets and the default sheet will be shown instead.`,
    scope: "world",
    type: Boolean,
    default: false,
    config: true
  });
*/
  let model = game.release.generation < 12 ? game.system.model : game.model
  for (let type of Object.keys(model.Actor))
    game.settings.register('ffs', `${type}ActorDefaultSheet`, {
      name: `Actor Sheet: ${type}`,
      hint: `Default sheet for actors of type ${type}`,
      scope: "world",
      type: String,
      choices: {default:""},//Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Actor").reduce((a,[k,v])=>{return a= {...a, [k]:k}},{default:""}),
      default: "default",
      config: true
    });
  
  for (let type of Object.keys(model.Item))
    game.settings.register('ffs', `${type}ItemDefaultSheet`, {
      name: `Item Sheet: ${type}`,
      hint: `Default sheet for items of type ${type}`,
      scope: "world",
      type: String,
      choices: {default:""},//Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Item").reduce((a,[k,v])=>{return a= {...a, [k]:k}},{default:""}),
      default: "default",
      config: true
    });

  game.settings.register('ffs', 'invertSizing', {
    name: `Invert Sizing`,
    hint: `When enabled mouse wheel down will reduce text size rather than increase.`,
    scope: "client",
    type: Boolean,
    default: false,
    config: true
  });

});
Hooks.on('renderSettingsConfig', (app, html, options)=>{
  //console.log(options)
  let model = game.release.generation < 12 ? game.system.model : game.model
  if (Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Actor").length) {
    html.find('section[data-tab=ffs]').find('select[name$=ActorDefaultSheet]')
      .html(Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Actor").reduce((a,[k,v])=> a+= `<option value="${k}">${k}</option>`,`<option value=""></option>`))
    for (let type of Object.keys(model.Actor)) {
      html.find(`select[name="ffs.${type}ActorDefaultSheet"]`).val(game.settings.get('ffs', `${type}ActorDefaultSheet`))
    }
  } else html.find('section[data-tab=ffs]').find('select[name$=ActorDefaultSheet]').each(function(){$(this).closest('div.form-group').hide()})
  
  if (Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Item").length) {
    html.find('section[data-tab=ffs]').find('select[name$=ItemDefaultSheet]')
      .html(Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document=="Item").reduce((a,[k,v])=> a+= `<option value="${k}">${k}</option>`,`<option value=""></option>`))
    for (let type of Object.keys(model.Item)) {
      html.find(`select[name="ffs.${type}ItemDefaultSheet"]`).val(game.settings.get('ffs', `${type}ItemDefaultSheet`))
    }
  } else html.find('section[data-tab=ffs]').find('select[name$=ItemDefaultSheet]').each(function(){$(this).closest('div.form-group').hide()})
})
/*
Hooks.on('renderActorSheet', (app, html, data)=>{
  if (!game.settings.get('ffs', 'overridePlayerCharacterSheet')) return;
  if (game.user.isGM) return;
  if (game.settings.get('ffs', 'defaultSheet')=="default") return ui.notifications.warn('No default sheet selected.')
  app.object.freeformSheet(game.settings.get('ffs', 'defaultSheet'))
  html.css({display:'none'})
  html.ready(function(){app.close()})
});

Hooks.on('getActorSheetHeaderButtons', (app, buttons)=>{
  return 
  if (Object.keys(game.settings.get('ffs', 'sheets')).length)
  buttons.unshift({
    "label": "Freeform Sheet",
    "class": "ffs-sheet",
    "icon": "fas fa-file-alt",
    onclick: async (e)=>{
      let sheets = Object.keys(game.settings.get('ffs', 'sheets'))
      let defaultSheet = app.actor.getFlag('ffs', 'defaultSheet')
      if (!defaultSheet) {
        defaultSheet = sheets[0]
        await app.actor.setFlag('ffs', 'defaultSheet', defaultSheet)
      }
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
*/
// add actor directory context menu options for each sheet

Hooks.on('getSidebarTabEntryContext', (element, options)=>{
  
  let collection = game.release.generation < 12 ? element[0].dataset.tab : element._element[0].dataset.tab
  if (!["actors", "items"].includes(collection)) return
  for (let name of Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document==collection.capitalize().replace('s','')).map(([k,v])=>k)) {
    let templates = game[collection].filter(a=>a.getFlag('ffs', name)?.template);
    for (let template of templates) {
      if (template && game.user.isGM) {
        options.push(
          {
            "name": `Apply ${name.capitalize()} ${template.type.capitalize()} Template`,
            "icon": `<i class="fas fa-download"></i>`,
            "element": {},
            condition: li => {
              return (template.id != li.data("documentId") && template.type==game[collection].get(li.data("documentId")).type)
            },
            callback: async li => {
              const doc = game[collection].get(li.data("documentId"));
              let apply = await Dialog.prompt({
                title: `Confirm Apply Template`,
                content: `<center><p> This will apply all fields and configuration from ${template.name} to ${doc.name}</p><center>`,
                callback:()=>{return true},
                close:()=>{return false}
              });
              if (!apply) return ui.notifications.info('Freeform Sheet template application aborted.');
              await ffs.clone(name, template, doc) ;
              await doc.setFlag('ffs', 'defaultSheet', name)
              await doc.setFlag('core', 'sheetClass', doc.documentName=='Actor'? "ffs.defaultActorFFS":"ffs.defaultItemFFS")
              const sheet = doc.sheet;
              await sheet.close();
              doc._sheet = null;
              delete doc.apps?.[sheet.appId];
              
              //doc.sheet.render(true)
              //doc.freeformSheet(name);
              return ui.notifications.info(`Freeform Sheet '${template.name}' applyed to '${doc.name}.'`);
            }
          }
        );
      }
    }
  }
  options.push(
    {
      "name": `Apply to ${collection.capitalize()} of Same Type`,
      "icon": `<i class="fas fa-upload"></i>`,
      "element": {},
      condition: li => {
        let doc = game[collection].get(li.data("documentId"))
        return  Object.keys(game.settings.get('ffs', 'sheets')).some(name=>doc.getFlag('ffs', name)?.template)
      },
      callback: async li => {
        let template = game[collection].get(li.data("documentId"));
        let apply = await Dialog.prompt({
          title: `Confirm Apply Template`,
          content: `<center><p> This will apply all fields and configuration from ${template.name} to all ${collection} of type ${template.type}.</p><center>`,
          callback:()=>{return true},
          close:()=>{return false}
        });
        if (!apply) return ui.notifications.info('Freeform Sheet template application aborted.');
        let name = Object.keys(game.settings.get('ffs', 'sheets')).find(name=>template.getFlag('ffs', name)?.template)
        for (let doc of game[collection].filter(a=>a.type==template.type && template.id!=a.id)) {
          await ffs.clone(name, template, doc) 
          await doc.setFlag('ffs', 'defaultSheet', defaultSheet)
        }

        return ui.notifications.info(`Freeform Sheet template from '${template.name}' applyed to all ${template.type} ${collection}`);
      }
    }
  );
});

Hooks.on('ready', ()=>{
  if (!game.user.isGM) return;
  let sheets = game.settings.get('ffs', 'sheets')
  let needDocument = Object.entries(sheets).filter(([k,v])=>!v.document)
  if (needDocument.length) {
    for (let [k,v] of needDocument)
      sheets[k].document = "Actor"
    game.settings.set('ffs', 'sheets', sheets)
  }
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
  render(force, options) {
    if (!force) return true;
    if (options?.render)
      if (options?.render == false) return;
    let defaultSheet = this.actor.getFlag('ffs', 'defaultSheet') ?? game.settings.get('ffs', `${this.actor.type}ActorDefaultSheet`)
      //Object.entries(game.settings.get('ffs', 'sheets')).find(([k,v])=>v.document=="Actor"&&v.defaults?.includes(this.actor.type))?.at(0)
    if (!defaultSheet) {
      new DocumentSheetConfig(this.actor).render(true)
      if (game.user.isGM) alert(`Default Freeform Sheet not defined for actor type ${this.actor.type}`)
      return 
    }
    //let openSheet = Object.values(ui.windows).find(w=>w.id==`ffs-${defaultSheet}-${this.actor.id}`)
    //if (openSheet) return openSheet.render()
    this.actor.freeformSheet(defaultSheet)
    this.close()
    return true;
  }
   _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
     return true;
   }
}

class defaultItemFFS extends ItemSheet {

  static get defaultOptions() {
    const _default = super.defaultOptions;

    return {
      ..._default,
      classes: ['hidden', 'sheet', 'item', 'ffs-dummy', 'form']
    };
  }
  render() {
    let defaultSheet = this.item.getFlag('ffs', 'defaultSheet') ?? game.settings.get('ffs', `${this.item.type}ItemDefaultSheet`)
      //Object.entries(game.settings.get('ffs', 'sheets')).find(([k,v])=>v.document=="Item"&&v.defaults?.includes(this.item.type))?.at(0)
    if (!defaultSheet) {
      new DocumentSheetConfig(this.item).render(true)
      if (game.user.isGM) alert(`Default Freeform Sheet not defined for item type ${this.item.type}`)
      return 
    }
    this.item.freeformSheet(defaultSheet)
    this.close()
  }

}

Hooks.once('setup', function () {
  Actors.registerSheet('ffs', defaultActorFFS);
  Items.registerSheet('ffs', defaultItemFFS);

})

Hooks.on('renderDocumentSheetConfig', async (app, html)=>{
  if (!['Actor', 'Item'].includes(app.object.documentName) ) return;
  let sheets = Object.entries(game.settings.get('ffs', 'sheets')).filter(([k,v])=>v.document==app.object.documentName)
  if (sheets.length == 0) return
  let defaultSheet = app.object.getFlag('ffs', 'defaultSheet') ?? game.settings.get('ffs', `${app.object.type+app.object.documentName}DefaultSheet`)
      //Object.entries(game.settings.get('ffs', 'sheets')).find(([k,v])=>v.document==app.object.documentName&&v.defaults?.includes(app.object.type))?.at(0)
  /*
  if (!defaultSheet) {
    defaultSheet = sheets[0][0]
    await app.object.setFlag('ffs', 'defaultSheet', defaultSheet)
  }*/
  let select = $(`<select>${sheets.reduce((a,[k,v])=> a+=`<option value="${k}">${k}</option>`,``)}</select>`)
  select.val(defaultSheet)
  select.change(function(){
    app.object.setFlag('ffs', 'defaultSheet', this.value)
  })
  let group = $(`<div class="form-group">
        <label>Freeform Sheet</label>
        
        <p class="notes">Override default sheet setting ${app.object.type+app.object.documentName}DefaultSheet for when ffs.defaultActorFFS is selected. ${game.user.isGM?`<br><a onclick="game.settings.sheet.render(true, {module:'ffs'})">Configure Game Settings</a>`:''}</p>
    </div>`)
  group.find('label').after(select)
  html.find('button').before(group)
  html.find('button').click(function(){
    Object.values(ui.windows).filter(w=>w.id.includes(app.object.id)).forEach(w=>w.close())
  })
  app.setPosition({height: 'auto'})
})