# Freeform Sheets

Breif tutorial: https://youtu.be/XLnb0dkMItc

Create configurable sheets for your character from image files.

Supports: inline rolls, entity links, other enriched data, @attribute replacement for core actor fields as well as roll data.

Fonts can be added through the core font settings.

![Freefrom Sheet Example](https://user-images.githubusercontent.com/37848032/235782729-8c172940-526c-4103-8dee-765351e40510.png)

Updates

1.13.3
  - remove console.log from actor update hook

1.13.2
  - updates to spans will no longer trigger a whole sheet render for other user viewing the sheet, but just refresh that span

1.13.1
  - fix typos and logs from recent changes

1.13.0
  - new configuration allowing for showing images for content links along with the option to hide the text
  - fixed scaling of the sheet in configuration so it does not double scale anymore

1.12.0
  - All sheet updates from other users will re-render the sheet for other users viewing the sheet.
  
1.11.7
  - Removed test code that broke all actor updates in the last update

1.11.6
  - All @ fields get refreshed when an actor updates. This should refresh any derrived fields.

1.11.5
  - Fixed images not getting their size from fontSize if they happened to be caught in a refresh from updateActor hook

1.11.3
  - image elements in spans will size with font size now

1.11.2
  - fixed span outlines not being removed on edit dialog close

1.11.1
  - filter dialog now shows current values next to label
  - setting default color in sheet config now works
  - added font preview text to sheet config
  - added setting default font size to sheet config and user font config

1.11.0
  - span  edit dialogs and fix dialog now mark fields being edited with red outlines
  - sheet backgrounds are now img element instaed of background
  - this allows for filtering of just the sheet. filters no longer effect spans. You may need to fix text configuration on existing sheets if you were inverting.
  - also allows for scaling of images so you don't have to resize before upload
  - You can now scale your image in the configuration dialog with the scroll wheel over the sizer or using the header buttons
  - fixed double click not working if the span also had a @UUID
  - default font config added to config sheet header, but color is not functional yet

1.10.0
  - fix sheet dialog button added to header to fix or delete spans you might break experimenting with stuff
  - better tooltips for header buttons
  - fixed right click on text spans sometimes not focusing and bringing to edit mode
  - span edit dialog will now resize itself if you want to make the text area larger by dragging it from the handle bottom-right 
  - fields with editable fields will have a pointer cursor indicating they can be double clicked

1.9.1-1.9.2
  - span edit dialog uses textarea now
  - copy event on span so it will capture stored text rather than the span html as it would sometimes do

1.9.0
  - Big update to the hook for actor updates. The sheet no longer fully re-renders. If a span has an @value that matches the update, it will be updated individually.
  - This might break updates in some systems if they are still using getRollData values. Working on a fix for this.

1.8.8
  - reverted using .getRollData() for @ field button because it broke double click to edit because some systems return realative values rather than updatable ones

1.8.7
  - template actor create now has default name in the dialog

1.8.6
  - fix module.json v10 warnings

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
