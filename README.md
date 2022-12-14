# Freeform Sheets
Create configurable sheets for your character from image files.

Supports: inline rolls, entity links, other enriched data, @attribute replacement for core actor fields as well as roll data.

Fonts can be added through the core font settings.


![Freefrom Sheet Example](https://github.com/xaukael/ffs/blob/248ea21e6173638bd022dd68055fe5554ab6f847/ffs-example.jpg)

Updates

1.8.1 - 1.8.5 
  - span dialog selects current value on open
  - span dialog sets value on render so it doesn't break with quotes now which will allow for putting html elements in there. images and custom styles yay
  - dragging draggable elements to the sheet will add the text if the drag event does not have JSON data set

1.8.0
  - font size is adjusted 1px at a time now, use shift to change rapidly
  - improved/updated help dialog text
  - dialog will appear on ready if no sheets are configured to direct to sheets config or disabling the module

1.7.7
  - resize of text fonts adjusts y value to keep the bottom static again
  - Freeform Sheet button on actor sheets opens default sheet on left click if there is one. Can still right click for list.

1.7.6
  - removed console logs

1.7.5
  - @ button in span dialog now pulls roll data instead of just data.data or system
  - shift+wheel will now scale font quicker at larger font sizes
  
1.7.4
  - span positions rounded so they save as whole integers
  - font size updates debounced to reduce update spam

1.7.3
  - better auto sizing accounting for the possibility that a style adjusts the window padding
  - fixed header's sheet button changing to a name

1.7.2
  - fixed bug where cancelling filter would unset all filters
  - moved other sheets button to icon in front of header
  - added option to hide content link icons, right click the 'A' where fonts are set. Will look for better place for that setting later
  
1.7.1
  - fixed bug with entity dropping
  - added new cleanup of bad texts
  
1.7.0
  - added option for forcing players to see a default sheet instead of the system's sheet
  - added buttons to the freeform sheet header and actor sheet header to view sheet options
  
1.6.1
  - fixes for v9 compatibility mess
  - Hooks properly removed so sheets do not re-open on actor updates
  - @ field value updates work now
  - template actors get sheet images as actor img
  - field dialogs open with text more or less centered at the cursor
  - missing roll data values are back to just @ field now because it broke content links
  
1.6.0
  - v9 compatibility
  
1.5.0
  - now with templating
  - fixed issues with @ fields that return null
  
1.4.0
  - fixed issue of sheet rendering from the actor hook not taking resizing into account
  - can now double click an @ field for a dialog to change it's value
  
1.3.0
  - fixed scaling not saving to named config
  - added lock button
  - added dialogs for changing @ fields because they could be long and hard to edit
  - @ dialogs have a button that shows and has selectable @ paths
  
1.2.1
  - removed a bit of debugging code that caused errors
  
1.2.0
  - Sheet configs moved out of macro flags into world settings
  - better configuraton ui using jquery resizeable
  - re-ordered header icons
  - Context Menu items added to actor directory for each sheet. (requires reload to reflect sheet adds and deletes)
  
1.1.1
  - Fixed broken fonts with config move
  
1.1.0
  - Filters and Fonts per player and per sheet now
  
1.0.0
  - We will call this version 1. inputs are gone, the spans are just set as role="textbox" now. 
  - Controls have not changed, though the cursors have to better indicate what is going on.
  
0.0.9
  - fixed a bug where filter would not default correctly

0.0.8
  - fixed a bug where filter temporarily resets when changing font

0.0.7 
  - now with a filter configuration dialog instead of invert toggle
