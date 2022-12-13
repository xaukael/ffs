# Freeform Sheets
Allows creation of any number of configurable sheets for your character from image files.

Supports: inline rolls, entity links, other enriched data, @attribute replacement for core actor fields as well as roll data.

Fonts can be added through the core font settings.

0.0.7 
  - now with a filter configuration dialog instead of invert toggle
  
0.0.8
  - fixed a bug where filter temporarily resets when changing font
  
0.0.9
  - fixed a bug where filter would not default correctly

1.0.0
  - We will call this version 1. inputs are gone, the spans are just set as role="textbox" now. 
  - Controls have not changed, though the cursors have to better indicate what is going on.
  
1.1.0
  - Filters and Fonts per player and per sheet now
  
1.1.1
  - Fixed broken fonts with config move
  
1.2.0
  - Sheet configs moved out of macro flags into world settings
  - better configuraton ui using jquery resizeable
  - re-ordered header icons
  - Context Menu items added to actor directory for each sheet. (requires reload to reflect sheet adds and deletes)
  
1.2.1
  - removed a bit of debugging code that caused errors
  
1.3.0
  - fixed scaling not saving to named config
  - added lock button
  - added dialogs for changing @ fields because they could be long and hard to edit
  - @ dialogs have a button that shows and has selectable @ paths
  
1.4.0
  - fixed issue of sheet rendering from the actor hook not taking resizing into account
  - can now double click an @ field for a dialog to change it's value
  
1.5.0
  - now with templating
  - fixed issues with @ fields that return null
  
1.6.0
  - v9 compatibility
  
1.6.1
  - fixes for v9 compatibility mess
  - Hooks properly removed so sheets do not re-open on actor updates
  - @ field value updates work now
  - template actors get sheet images as actor img
  - field dialogs open with text more or less centered at the cursor
  - missing roll data values are back to just @ field now because it broke content links

![Freefrom Sheet Example](https://github.com/xaukael/ffs/blob/248ea21e6173638bd022dd68055fe5554ab6f847/ffs-example.jpg)
