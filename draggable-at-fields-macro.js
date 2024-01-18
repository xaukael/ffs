// This will create a dialog to find fields to use on your actor freeform sheet 
// You can drag fields from thid dialog directly to the sheet
// Great for templating complex systems

let doc = game.user.character
function buildObjectElements(el, objectPath) {
  let property = getProperty(doc, objectPath)
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
        <a draggable="true">${key} : ${typeof(prop)=="string"?`"${prop}"`:prop}</a>
      </div>`));
  }
  return el;
}

let d = new Dialog({title: '@fields', content: '', buttons:{}, render: (html)=> {
  let $atOptions = $(`<div class="a-object-path-root" data-path="system" 
  style="width: max-content; height: max-content; color: white; "><a></a></div>`)
  console.log($atOptions)
  buildObjectElements($atOptions, `${(game.release?.generation >= 10)?'system':'data.data'}`)
  $atOptions.find(`.object-path, .value-path`).hide()
  $atOptions.children(`.object-path, .value-path`).show()
  $atOptions.find('[draggable=true]')
    .on('dragstart', function(e){
      e.originalEvent.dataTransfer.setData("text/plain", '@'+$(this).parent().data().path.replace('system.','').replace('data.data.', ''))})
    .css('cursor', 'grab')
  $atOptions.find(`a`).click(function(){
    $(this).parent().children('div').toggle()
    d.setPosition({height: 'auto'})
  })
  $atOptions.find(`.value-path > a`).click(function(){
    console.log('@'+$(this).parent().data().path.replace('system.','').replace('data.data.', ''))
    d.setPosition({height: 'auto'})
  })
  
  $(html[0]).append($atOptions)
  
}},{height: 'auto', resizable: true}).render(true)
