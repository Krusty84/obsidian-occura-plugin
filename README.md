# Occura Plugin: highlighting word occurrences

### Why another plugin?
I couldn't find the usual functionality that I used in Notepad++ or different IDEs, where double-clicking on a word immediately showed me how often it appears in the open document.

### Features
#### Release 1.4.0:
New features has been added:

1. Added case insensitivity mode for dynamic word selection

2. Keywords can be uploaded/downloaded to/from a plain text file with a comma separator between words

3. Added a reset button to default settings

<img width="843" alt="image" src="https://github.com/user-attachments/assets/57c9b219-1fe3-499b-8a4d-09a9e071e31b" />

#### Release 1.3.2:
Some bugs have been fixed, thanks dear [BlackUdon](https://github.com/BlackUdon)

#### Release 1.3.1:
Some bugs have been fixed, thanks dear [BlackUdon](https://github.com/BlackUdon)
 
#### Release 1.3.0: 
Automatic highlighting of keywords (It works only in Source or Live preview mode!)

New settings has been added
![image](https://github.com/user-attachments/assets/3041fbf9-b258-421e-89aa-894bb025546e)

New command has been added

![image](https://github.com/user-attachments/assets/262ff0f5-bb12-4e13-880e-ffed812681bd)

#### Release 1.2.0:
Convert found occurrences to tags (It works only in Source or Live preview mode!)

New command has been added

![image](https://github.com/user-attachments/assets/d218a52d-3447-4676-baf1-9d7b5d212468)

#### Release 1.1.0:
Permanent Highlighting for found occurrences (It works only in Source or Live preview mode!)

New command has been added:

1. Set permanently highlight for occurrences
2. Remove permanently highlight for occurrences

![image](https://github.com/user-attachments/assets/93a04250-f060-437a-a887-31daa41abe80)

When Occura has highlighted the available occurrences, call the command: **Set permanently highlight for occurrences** and then the occurrences will be highlighted by the regular for Obsidian.md by color

![image](https://github.com/user-attachments/assets/1d638501-3477-4fe6-8166-48271c122520)


And call the: **Remove permanently highlight for occurrences** command to remove the previously set highlight

#### Release 1.0.0:
Basic functionality

- You simply double-click on a word and see the other occurrences of the word (or the selected part of it) highlighted.

  ![изображение](https://github.com/user-attachments/assets/164e0b3e-e02c-4903-abd5-a4006a931200)

- In the settings, you can specify the highlight color, hotkeys for quickly enabling/disabling the plugin, and the display of the number of matches found in the Status bar.

  ![изображение](https://github.com/user-attachments/assets/e6f33f63-a39b-4997-bae3-ba7cfa9c5b66)

#### Installing the plugin
- Open Obsidian settings
- Go to Community Plugins
- Select Browse and search for Occura Plugin
- Install the plugin
- Look through "Installed plugins" and enable Occura Plugin (toggle)


#### Manually installing the plugin
- Copy over `main.js` and `manifest.json` to your vault `/path/to/your/vault/.obsidian/plugins/obsidian-occura-plugin/`.
- Enable plugins in Obsidian settings
- Enable Occura Plugin in the Community Plugins tab

#### License
[MIT](https://choosealicense.com/licenses/mit/)

#### Author
[Alexey Sedoykin](https://www.linkedin.com/in/sedoykin/)
