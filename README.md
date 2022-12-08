# Freeform Sheets
Allows creation of macros for any number of configurable sheets for your character from image files that you can place text of any size anywhere.

Example script macro command: `character.freeformSheet(this.id, 'dnd5e');`

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

![Freefrom Sheet Example](https://github.com/xaukael/ffs/blob/248ea21e6173638bd022dd68055fe5554ab6f847/ffs-example.jpg)
