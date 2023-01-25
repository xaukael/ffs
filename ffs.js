/**  
 * 
 * @param {string} name name given to the sheet in the module configuration. all text and config on the sheet will be stored under in the actor's ffs.name flag
 * 
*/
Actor.prototype.freeformSheet = async function(name) {
  let character = this;
  name = name.slugify().replace(/[^a-zA-Z0-9\- ]/g, '');
  
  if (ffs.restirctedNames.includes(name)) return console.error("restricted name", name);
  //let macro = null;
  //macro = game.macros.get(macroId);
  //if (!macro) return console.error("macro not found. first parameter should be this.id");
  let sheet = game.settings.get('ffs', 'sheets')[name];
  if (!sheet) return console.error(`sheet config for ${name} not found in game settings`);;
  let id = `ffs-${name}-${character.id}`;
  
  if ($(`div#${id}`).length) 
    return ui.windows[$(`div#${id}`).data().appid].render(true).bringToTop();

  if (!character.getFlag('ffs', name)) 
    await character.setFlag('ffs', [name], {})
  if (!character.getFlag('ffs', name)?.config)
    await character.setFlag('ffs', [name], {config: {scale: 1, color: "#000000", filter: ''}});
  
  // perform cleanup of empty and NEW TEXT. Should not be necessary
  for (const [key, value] of Object.entries(character.getFlag('ffs', name))) {
    if (ffs.restirctedNames.includes(key)) continue;
    if (!value.text || ($(`<span>${value.text}</span>`).text()=='' && !value.text.includes('img'))) 
      await character.unsetFlag('ffs', `${name}.${key}`)
  }

  ffs[id] = {...ffs[id], ...character.getFlag('ffs',`${name}.config`), ...sheet};
  //console.log(name, ffs[id])
  let options = {width: 'auto', height: 'auto', id}
  /*
  if (ffs[id].width && ffs[id].height)
    options = {...options, ...{width: ffs[id].width*ffs[id].scale+16, height: ffs[id].height*ffs[id].scale+46}};
    if (!ffs[id].left) {
    let i = await loadTexture(ffs[id].background);
    options = {...options, ...{width: i.orig.width*ffs[id].scale+16, height: i.orig.height*ffs[id].scale+46}}
  }
  */
  if (ffs[id].position) options = {...options, ...ffs[id].position}

  let formatText = async function(text) {
    if (game.release?.generation >= 10) return await TextEditor.enrichHTML(Roll.replaceFormulaData(text, {...character.system, ...character.getRollData(), name: character.name}), {async:true})
    else return await TextEditor.enrichHTML(Roll.replaceFormulaData(text, {...character.data.data, ...character.getRollData(), name: character.name}), {async:true})
    
  }

  let newSpan = async function(key, value){
    let updateSizeDebounce = foundry.utils.debounce((character,name,key,fontSize,y)=> {
      character.setFlag('ffs', [`${name}.${key}`], {fontSize, y}) 
      $('.font-tooltip').remove();
    }, 500);
    
    let $span = $(`<span id="${key}" style="cursor: text; position: absolute;">${await formatText(value.text)}<span>`);
    $span.css({left: value.x+'px', top: value.y+'px', fontSize: value.fontSize})
    let click = {x: 0, y: 0};
    $span
    .focusout(async function(){
      $(this).find('span').remove();
      let input = $(this).html().trim();
      if (input == "" || input == "NEW TEXT") {
        //console.log(`removing span`, name, key)
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
      $(this).select();
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
      fontSize = Math.max(fontSize+change, 2);
      if (fontSize==2) return console.log('font size minimum reached');
      let y = (parseInt($(this).css('top'))-change);
      $(this).css({fontSize: fontSize +"px", top: y+'px'});
      $('.font-tooltip').remove();
      $('body').append($(`<span class="font-tooltip" style="position: absolute; top: ${e.clientY-10}px; left: ${e.clientX+10}px; pointer-events: none; color: white; background: #000; border: 1px solid white; padding:2px; z-index:1000;">${fontSize}px</span>`));
      updateSizeDebounce(character,name,key,fontSize,y);
    })
    .on('copy', function(e){
        let text = character.getFlag('ffs', name)[key].text;
        e.originalEvent.clipboardData.setData('text/plain', text);
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
        $(this).css('cursor','text');
      }
    })
    .contextmenu(function(e){
      e.stopPropagation();
      e.preventDefault();
      if ($(this).parent().hasClass('locked')) return;
      let text = character.getFlag('ffs', name)[key].text
      if ((e.ctrlKey || text.includes('@') || text.includes('[[')) && !e.shiftKey) {
        let options = $(this).offset();
        options.left -= 190;
        options.top -= 45;
        let valueDialog = new Dialog({
          title: key,
          content: `<textarea type="text" value="" style=" margin-bottom:.5em;" autofocus></textarea>
          `,//width: calc(100% - 2.3em); <button class="at" style="width: 2em; height: 26px; float: right; line-height: 22px;">@</button>
          buttons: {confirm: {label:"Confirm", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
            confirm = true;
            let input = html.find('textarea').val();
            if (input == "" || input == "NEW TEXT") {
              console.log(`removing span`, name, key)
              await character.unsetFlag('ffs', `${name}.${key}`);
              return $(this).remove();
            }
            $(this).html(await formatText(input))
            await character.setFlag('ffs', `${name}.${key}`, {text: input});
          }},
          cancel: {label:"Cancel", icon: '<i class="fas fa-times"></i>',callback: async (html)=>{}}},
          default: 'confirm',
          render: (html)=>{
            

            html.find('textarea').val(text);
            html.find('textarea').select();
            html.parent().parent() 
            .mouseenter(function(){$(`#${key}`).css({'text-shadow': '0 0 8px green'})})
            .mouseleave(function(){$(`#${key}`).css({'text-shadow': ''})})
            
            //function buildObjectElements(rollData, el, objectPath) {
              //let property = getProperty(rollData, objectPath)
            function buildObjectElements(el, objectPath) {
              let property = getProperty(character, objectPath)
              if (property===null) return;
              for (let key of Object.keys(property)) {
                let prop = foundry.utils.getProperty(character, `${objectPath}.${key}`)
                //let prop = foundry.utils.getProperty(rollData, `${objectPath}.${key}`)
                if (typeof(prop) === 'object') {
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
            $(`#${key}`).css({'text-shadow': ''})
            return $('body').find('.object-path-root').remove();
          }
        },{...options, id: `${id}-${key}-dialog`}).render(true)

        return;
      }
      $(this).html(text)
      $(this).prop('role',"textbox")
      $(this).prop('contenteditable',"true")
      $(this).focus()
    })
    .dblclick(function(e){
      let text = character.getFlag('ffs', name)[key].text;
      let match = text.match(/@([a-z.0-9_\-]+)/gi);
      if (!match) return; 
      text = match[0];
      text = text.replace('@', '');
      if (!foundry.utils.hasProperty(game.system.model.Actor[character.type], text)) return;
      let val;
      if (game.release?.generation >= 10) val = foundry.utils.getProperty(character.system, text);
      else val = foundry.utils.getProperty(character.data.data, text);
      if (typeof(val)=='object') return;
      let options = $(this).offset();
      options.left -= 190;
      options.top -= 45;
      new Dialog({
        title: `Edit ${text}`,
        content: `<input type="${typeof(val)}" value="${val}" style="width: 100%; margin-bottom:.5em; text-align: center;" autofocus></input>`,
        buttons: {confirm: {label:"", icon: '<i class="fas fa-check"></i>', callback: async (html)=>{
          let input = html.find('input').val();
          if (html.find('input')[0].type == 'number') input = Number(input)
          if (!input && input != 0) return ui.notifications.warn('empty values can be problematic for freeform sheets');
          await character.update({[`${(game.release?.generation >= 10)?'system':'data'}.${text}`]: input});
        }}},
        default: 'confirm',
        render: (html) =>{
          html.find('input').select();
        },
        close: ()=>{ return
        }
      },{...options, id: `${id}-${key}-value-dialog`}).render(true);
    })
    /*
    .click(async function(e){
      console.log(e)
      if (e.target!=e.currentTarget) return console.log('event stop');
      $(this).contextmenu();
    })
    */
    return $span;
  }

  let d = new Dialog({
    title: `${character.name}`,
    content: `<div class="sizer"><div class="ffs" style="height:${ffs[id].height}px; width:${ffs[id].width}px;"></div></div>`,
    buttons: {},
    render: async (html)=>{
      //console.log(`${id} render`, ffs[id])
      let {width, height, left, top, background, color , scale , fontFamily, fontWeight, filter, locked, hideContextIcons} = ffs[id];

      // apply configs
      html.css({height: 'max-content !important'});
      let $sheet = html.find('div.ffs');

      $sheet.before($(`<style>
        #${id} {height: auto !important; width: auto !important;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs {font-family: ${fontFamily}; font-weight: ${fontWeight}; cursor: cell; position: relative;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs.locked {cursor: default;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs.locked > span {cursor: default !important;}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs * {border: unset !important; padding: 0; background: unset; background-color: unset; color: ${color} !important;} 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span > input:focus {box-shadow: unset; } 
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span:focus-visible {outline-color:white; outline:unset; /*outline-style: outset; outline-offset: 6px;*/}
        #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span { white-space: nowrap; position: absolute; }
        ${hideContextIcons?`#${id} > section.window-content > div.dialog-content > div.sizer > div.ffs > span > a > i {display:none;} `:''}
      </style>`));
      // remove dialog background
      //#${id} > section.window-content , #${id} > section.window-content > div.dialog-content > div.sizer > div.ffs, #${id} > section.window-content > div.dialog-content > div.sizer
      //{overflow:hidden;}
      html.parent().css({background:'unset'});
      
      $sheet.parent().css({height: `${height*scale}px`, width: `${width*scale}px`})
      
      //console.log(d._element.width(),d._element.height(), $sheet.parent().width(), $sheet.parent().height())
      // apply config styles
      $sheet.css({
        'transform-origin': 'top left',
        'transform': `scale(${scale})`,
        'filter': filter,
        'background-image': `url(${background})`,
        'background-repeat' : 'no-repeat',
        'background-position': `top -${top}px left -${left}px`
      });
      //'height': `${height}px`,'width': `${width}px`
      

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
        let value = {x: e.offsetX, y: e.offsetY-8, text: e.ctrlKey?"@":"NEW TEXT", fontSize: 16};
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
        try{data = JSON.parse(text);}catch(e){}
        console.log(data);
        if (typeof data == 'object')
          if (game.release?.generation >= 10) text = fromUuidSync(data.uuid).link
          else text = CONFIG[data.type].collection.instance.get(data.id).link
        if (!text) return;
        let id = randomID();
        let value = {x: e.offsetX, y: e.offsetY-8, text, fontSize: 16};
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
        //delete ffs[id];
        //delete character.apps[d.appId];
        return;
      }
  }, options
  ).render(true);

   // I do not use the document.apps because it causes renders on every flag change I do. This way, I can ignore reloads on all ffs updates
  // character.apps[d.appId] = d;
  
  if (ffs[id].hook) Hooks.off(`update${this.documentName}`, ffs[id].hook)
  ffs[id].hook = 
    Hooks.on(`update${this.documentName}`, async (doc, updates)=>{
      if (doc.id!=character.id) return;
      if (!d.element) return;
      if (foundry.utils.hasProperty(updates, "flags.ffs")) return true;
      for (let key of Object.keys(foundry.utils.flattenObject(updates))) 
        for (let [spanId, span] of Object.entries(character.getFlag('ffs', name)).filter(([spanId, span])=>key.split('.').some(i=>span.text?.includes(i)))) 
          d.element.find(`span#${spanId}`).html(await formatText(span.text))
  //for (let [spanId, span] of Object.entries(character.getFlag('ffs', name)).filter(([spanId, span])=>span.text?.includes(key.replace((game.release?.generation >= 10)?'system.':'data.', '')))) 
    //okay: key.includes(span.text.match(/@([a-z.0-9_\-]+)/gi)[0].replace('@', ''))
    //better: span.text.includes('@') && span.text.match(/@([a-z.0-9_\-]+)/gi)?.some(m=>key.includes(m.replace('@', ''))) 
      //should fix SWB shortened rolldata issue
        //returns undefined of no match is found no version check necessary
        //key.split('.').some(i=>span.text.includes(i)) if any property is in any text of the span
        //derrived values may still be problematic. for these, I might have to split the key and check includes each part, or just format all the spans again (-385)
      //d.render(true);//, { width: ffs[id].width*ffs[id].scale+16, height: ffs[id].height*ffs[id].scale+46}
    })

  let waitRender = 100;
  // wait for the element
  if (!d._element) 
    while (!d._element  && waitRender-- > 0) await new Promise((r) => setTimeout(r, 50));


  // set header buttons
  let $header  = d._element.find('header');
  if (game.user.isGM)
    $header.find('h4.window-title').after($(`<a><i class="fas fa-cog"></i></a>`).click(async function(){
      ffs.configure(name)
    }));
  // to remember last position  
  d._element.click(function(){ ffs[id].position = d._element.offset(); })

  $header.find('h4.window-title').after($(`<a><i class="fas fa-question-circle"></i></a>`).click(function(e){
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

  $header.find('h4.window-title').after($(`<a><i class="fas fa-font"></i></a>`).click(function(e){
    if ($(`#${id}-font-dialog`).length) return ui.windows[$(`div#${id}-font-dialog`).data().appid].bringToTop();
    new Dialog({
      title: `Font Configuration`,
      content: `
      ${(game.release?.generation < 10)?
        `<input type="text" class="fontFamily" placeholder="font name" style="width:100%">`:
        [...Object.keys(game.settings.get('core', 'fonts')), ...CONFIG.fontFamilies].reduce((a,f)=>a+=`<option value="${f}" style="font-family: ${f};">${f}</option>`,`<select class="fontFamily" style="width:100%">`) + `</select>`
      }
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

        $fontColor.change(async function(){
          let color = $(this).val();
          ffs[id].color = color;
          //$(this).prevAll().css({color});
          await character.setFlag('ffs', name, {config: {color}})
          d.render(true);
        });
      },
      close:(html)=>{ return }
    },{...$(this).offset(), width: 150, id: `${id}-font-dialog`}).render(true);
  })
  .contextmenu(async function(){
    let hideContextIcons = !ffs[id].hideContextIcons;
    ffs[id].hideContextIcons = hideContextIcons;
    await character.setFlag('ffs', name, {config: {hideContextIcons}});
    d.render(true);
  }).dblclick(function(e){e.stopPropagation();}));

  $header.find('h4.window-title').after($(`<a title="Sheet Filters" ><i class="fas fa-eye"></i></a>`).click( async function(e){
    if ($(`#${id}-filter-dialog`).length) return ui.windows[$(`div#${id}-filter-dialog`).data().appid].bringToTop();
    e.stopPropagation();
    let confirm = false;
    let values = character.getFlag('ffs', name).config.filter.split('%').map(f=>f.split('(')).map((f,i)=>!i?f:[f[0].split(' ')[1], f[1]]).reduce((a,f)=>{ return {...a, [f[0]]: f[1]}; },{})
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
        if (character.getFlag('ffs', name).config.filter) 
            $(`#${id}`).find('.ffs').css({filter: character.getFlag('ffs', name).config.filter});
          else
            $(`#${id}`).find('.ffs').css({filter: 'unset'});
        return }
    },{...$(this).offset(), id: `${id}-filter-dialog`}).render(true);
  }).dblclick(function(e){e.stopPropagation();}));

  $header.find('h4.window-title').after($(`<a title="Zoom In" ><i class="fas fa-plus"></i></a>`).click( async function(e){
    e.stopPropagation();
    let {scale, width, height} = ffs[id];
    scale += .1;
    scale = Math.round(scale*10)/10;
    ffs[id].scale = scale;
    $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
    await character.setFlag('ffs', name, {config: {scale}})
    d.render(true)
  }).dblclick(function(e){e.stopPropagation();}));

  $header.find('h4.window-title').after($(`<a class="zoom" title="Reset Scale"><b>${Math.round(ffs[id].scale*100)}%</b></a>`).click( async function(e) {
    let {scale, width, height} = ffs[id];
    scale = 1;
    ffs[id].scale = 1;
    $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
    await character.setFlag('ffs', name, {config: {scale}})
    d.render(true)
  }).dblclick(function(e){e.stopPropagation();}));

  $header.find('h4.window-title').after($(`<a title="Zoom Out" ><i class="fas fa-minus"></i></a>`).click( async function(e){
    e.stopPropagation();
    let {scale, width, height} = ffs[id];
    scale -= .1;
    scale = Math.round(scale*10)/10;
    ffs[id].scale = scale;
    $header.find('a.zoom > b').text(Math.round(scale*100)+'%')
    await character.setFlag('ffs', name, {config: {scale}})
    d.render(true)
  }).dblclick(function(e){e.stopPropagation();}));

  $header.find('h4.window-title').after($(`<a title="Drag Lock" ><i class="fas fa-lock${ffs[id].locked?'':'-open'}"></i></a>`).click( async function(e){
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

  if (Object.keys(game.settings.get('ffs', 'sheets')).length>1)
  $header.find('h4.window-title').before($(`<a title="Sheets" style="margin: 0 .5em 0 0;"><i class="fas fa-file-alt"></i></a>`).click( async function(e){
    ffs.sheets(character, e);
  }).dblclick(function(e){e.stopPropagation();}));

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
    content +=`
    <a class="sheet" name="${name}" title="${name}" style="width:${(config.width)/4}px; height:${(config.height)/4}px; overflow: hidden;
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

  let waitRender = 100;
  // wait for the element
  if (!$(`#${options.id}`).length) 
    while (!$(`#${options.id}`).length && waitRender-- > 0) await new Promise((r) => setTimeout(r, 50));
  ui.windows[$(`#${options.id}`).data().appid].setPosition({...options, height: 'auto'});
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
  let config = game.settings.get('ffs', 'sheets')[name];
  if (!config) {
      let sheets = {...game.settings.get('ffs', 'sheets'), ...{[name]: {}}}
      game.settings.set('ffs', 'sheets', sheets);
  }
  let i = await loadTexture(config.background);
  let width = i.orig.width;
  let height = i.orig.height;
  let confirm = false;
  let c = new Dialog({
    title: name,
    content: `<div class="ffs" style="position: relative; width: ${width}px; height:${height}px; margin: 10px;">
      <img src="${config.background}" style="position: absolute;">
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
      });
      
      c._element.find('h4.window-title').after($(`<a title="Change Image" ><i class="fas fa-image"></i></a>`).click(async function(){
        return new FilePicker({
          title: "Select a new image",
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
              c.setPosition()
            }
          }).render(true);
      }));
      
    },
    close: async (html)=>{ return false;}
  }, {height: 'auto', width: 'auto', id: `${name}-ffs-configuration`}).render(true);
  //await game.macros.get(macroId).update({'flags.-=ffs':null})
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

  game.settings.register('ffs', 'overridePlayerCharacterSheet', {
    name: `Override Player's Actor Sheets`,
    hint: `Players will not be able to access the system character sheets.`,
    scope: "world",
    type: Boolean,
    default: false,
    config: true
  });

  game.settings.register('ffs', 'defaultSheet', {
    name: `Default Sheet`,
    hint: `Sheet to show when `,
    scope: "world",
    type: String,
    choices: Object.keys(game.settings.get('ffs', 'sheets')).reduce((a,k)=>{return a= {...a, [k]:k}},{default:""}),
    default: "default",
    config: true
  });

});

Hooks.on('renderActorSheet', (app, html, data)=>{
  if (!game.settings.get('ffs', 'overridePlayerCharacterSheet')) return;
  if (game.user.isGM) return;
  if (game.settings.get('ffs', 'defaultSheet')=="default") return ui.notifications.warn('No default sheet selected.')
  app.object.freeformSheet(game.settings.get('ffs', 'defaultSheet'))
  html.css({display:'none'})
  html.ready(function(){app.close()})
});

Hooks.on('getActorSheetHeaderButtons', (app, buttons)=>{
  if (Object.keys(game.settings.get('ffs', 'sheets')).length)
  buttons.unshift({
    "label": "Freeform Sheet",
    "class": "ffs-sheet",
    "icon": "fas fa-file-alt",
    onclick: (e)=>{
      let defaultSheet = game.settings.get('ffs', 'defaultSheet');
      if (defaultSheet!='default') return app.object.freeformSheet(defaultSheet)
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

      console.log(actor)
      if (!actor) actor = game.user.character;
      if (!actor) return;
      if (game.settings.get('ffs', 'defaultSheet')=="default") return;
      actor.freeformSheet(game.settings.get('ffs', 'defaultSheet'))
     },
  })
})