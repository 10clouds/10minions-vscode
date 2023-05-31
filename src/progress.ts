import * as vscode from "vscode";

export const PROGRESS_MESSAGES = [
  "Reversing the polarity of the mainframe...",
  "Slapping the binary bug bad boys...",
  "Deploying extra fluffy parentheses...",
  "Knitting a sweater from spaghetti code...",
  "Unleashing wave of semantic tsunamis...",
  "Swapping gears and upgrading to light speed typing...",
  "Feeding the codebase unicorns...",
  "Checking if AI overlords approved your syntax...",
  "Diving deep into the sea of semicolons...",
  "Assembling the Council of Coders for a syntax showdown...",
  "Translating machine jargon into human palaver...",
  "Racing down the highway of 'Hello, World'...",
  "Setting phasers to 'debug'...",
  "Whispering sweet nothings to the if-then statements...",
  "Bringing the AI baking soda for that fizz in your function...",
  "Applying the secret sauce of digital dialects...",
  "Polishing binary baubles for a shiny new function...",
  "Flexing CodeMind's AI muscles for the heavy lifting...",
  "Performing digital gymnastics over your code hurdles...",
  "Firing up the AI afterburners for a code boost...",
  "Rescuing the lost semicolons from the edge of the file...",
  "Assembling an army of mini-bots for code invasion...",
  "Convincing your code it's not a butterfly, it's a function...",
  "Nudging the neurons for a mind-blowing code twist...",
  "Placing your request on the 10Clouds CodeMind runway for takeoff...",
  "Injecting a bit of AI wisdom into your brackets...",
  "Hosting a tea party with your strings and integers...",
  "Stepping into the CodeMind time machine to visit your vintage code...",
  "Throwing a lifeline to your drowning code in the sea of errors...",
  "Teaching your variables the art of Zen...",
  "Spinning the Wheel of Fortune... for your code...",
  "Performing an interpretive dance for your binary buddies...",
  "Dusting off your code's cobwebs with my AI broom...",
  "Charging through the syntax forest, machete in hand...",
  "Rolling out the red carpet for your fresh batch of functions...",
  "Transforming your code from a caterpillar into a butterfly...",
  "Summoning my AI sidekick for an extra pair of digital hands...",
  "Lighting a campfire under your code for some warmth...",
  "Stirring the pot of your code stew...",
  "Dishing out scoops of wisdom into your code sundae...",
  "Tidying up your code room before the syntax inspection...",
  "Flying through the galaxy of code in the CodeMind starship...",
  "Jazzing up your code with some AI improvisation...",
  "Embarking on a safari through your code wilderness...",
  "Squeezing the lemons out of your code for a refreshing function...",
  "Teaching your code how to walk and talk...",
  "Serving up some freshly baked code cookies...",
  "Kneading your code dough until it's nice and elastic...",
  "Unwrapping your code present from 10Clouds CodeMind...",
  "Knocking on the doors of your code castle...",
  "Suiting up for a deep dive into your ocean of code...",
  "Shaking the magic 8-ball for some coding wisdom...",
  "Blowing the dust off your forgotten functions...",
  "Constructing a new universe from your line of code...",
  "Arm-wrestling with your stubborn code...",
  "Building code sandcastles on the digital beach...",
  "Creating a symphony from the notes of your code...",
  "Brewing a cup of code tea for some warmth...",
  "Waking up your code with a splash of AI coffee...",
  "Climbing the Everest of your code mountain...",
  "Baking a cake from your mix of variables...",
  "Throwing a surprise party for your successful script...",
  "Picking up the pace with a dash of coding salsa...",
  "Channeling inner GPT-4, for the code force is strong with this one...",
  "Donning the Sherlock Holmes hat for a code investigation...",
  "Turning the page on your digital code book...",
  "Tossing the coding frisbee for some outdoor fun...",
  "Cracking the code eggs for a sumptuous script omelette...",
  "Lacing up the sneakers for a code marathon...",
  "Fine-tuning your code radio for crystal clear instructions...",
  "Strumming the strings of your code guitar...",
  "Tuning into the rhythm of your code melody...",
  "Flipping the pancake of your code for an even cook...",
  "Checking in at the code hotel for a deep dive...",
  "Making your code do the tango with a twist of AI flair...",
  "Launching a search and rescue mission for missing variables...",
  "Staging a grand opera from the drama of your code...",
  "Conducting a code orchestra with GPT-4 as the maestro...",
  "Playing hide-and-seek with your elusive bugs...",
  "Combing the beach for pearls of code wisdom...",
  "Delivering a pep talk to your underperforming functions...",
  "Hitching a ride on the binary express...",
  "Hitting the coding gym for a syntax workout...",
  "Dabbling in some code alchemy to turn bugs into features...",
  "Warming up for a sprint through your fields of code...",
  "Sowing seeds of logic into your garden of code...",
  "Engaging warp drive for light-speed code processing...",
  "Organizing a meet and greet between your variables and functions...",
  "Whipping up a storm in your code kitchen...",
  "Setting sail on the code sea, charting a course for clean syntax...",
  "Slicing through the Gordian knot of your tangled code...",
  "Crossing the code desert, oasis of solutions in sight...",
  "Setting up a digital picnic in your data fields...",
  "Rallying the troops for a major code offensive...",
  "Solving the Rubik's cube of your intricate code...",
  "Gearing up for a journey through your code maze...",
  "Unraveling the mystery of your secret code language...",
  "Adding a touch of magic to your code potion...",
  "Throwing a lifeline to your code stranded on 'Syntax Error' island...",
  "Putting on a jester's cap to juggle your line of codes...",
  "Brewing a strong potion of AI magic for your code...",
  "Dealing a hand of code cards for a game of Syntax Hold'em...",
  "Taking your code on a roller coaster ride through Loopy Land...",
  "Laying the track for your code train to function station...",
  "Curing your code's case of the hiccups...",
  "Tuning the engine of your code car for a smoother ride...",
  "Brushing up on GPT-4 artistry for a code masterpiece...",
  "Prepping the AI stage for your code's grand entrance...",
  "Paving the road to code success with 10Clouds cobblestones...",
  "Hopping on the AI magic carpet for a ride through code desert...",
  "Setting the stage for a code magic show...",
  "Digging up fossils from your code archaeology site...",
  "Sparking a light bulb moment for your code with GPT-4...",
  "Rounding up the code sheep for a syntax siesta...",
  "Leading your code to the treasure chest of solutions...",
  "Unleashing a swarm of debugging bees on your code...",
  "Dropping the mic after your code's stellar performance...",
  "Shuffling the code deck for a surprise hand...",
  "Hitching a ride on the binary carousel...",
  "Cooking up a storm in the code kitchen with 10Clouds CodeMind...",
  "Squaring the circle in your roundabout code...",
  "Raising the curtain on your code's big reveal...",
  "Building a castle from the bricks of your code blocks...",
  "Teaching your code to fly with the wings of AI...",
  "Unboxing your fresh delivery of flawless code...",
  "Conducting a diplomatic negotiation with your rebellious code...",
  "Crafting a digital sculpture from your raw lines of code...",
  "Finding the sweet spot in your code's golf swing...",
  "Dropping your code into the AI time capsule for a quick fix...",
  "Wielding the magic wand to transform your code pumpkin into a carriage...",
  "Hitting the jackpot on the code slot machine...",
  "Setting up a carnival in your code's amusement park...",
  "Lighting up the stage for your code's Broadway debut...",
  "Converting your code coal into shiny diamonds...",
  "Taking your code on a thrilling AI rollercoaster ride...",
  "Taming the wild horses of your unruly code...",
  "Weaving a safety net for your trapezing code stunts...",
  "Laying the golden eggs of wisdom into your code nest...",
  "Conducting an orchestra of harmonious code snippets...",
  "Hosting a masquerade ball for your incognito variables...",
  "Reading a bedtime story to your sleepy code...",
  "Serving up a sumptuous feast from your code ingredients...",
  "Setting the chessboard for a strategic code match...",
  "Launching a space expedition to explore your code cosmos...",
  "Directing your code in an award-winning drama...",
  "Stirring up a tornado to sweep away your code clutter...",
  "Charging into the AI arena for a coding tournament...",
  "Fishing for solutions in your sea of code...",
  "Running a marathon through the streets of your code city...",
  "Turning on the lights in your code's haunted house...",
  "Assembling a superhero team to combat your code villains...",
  "Carving a path through your jungle of code...",
  "Paddling upstream in your river of recursive calls...",
  "Cracking open the code piñata to unleash a burst of solutions...",
  "Munching on your spaghetti code for a wholesome meal...",
  "Drafting a peace treaty between your warring code factions...",
  "Brewing a storm in your code teacup...",
  "Staging a code magic show with GPT-4 as the wizard...",
  "Rallying the troops for an assault on Bug Castle...",
  "Riding the waves of your turbulent code ocean...",
  "Digging for treasure in your sandbox of code...",
  "Flying a kite in the winds of your code's imagination...",
  "Leaping over the hurdles in your code's obstacle course...",
  "Diving into the deep end of your code pool...",
  "Dusting off the cobwebs from your haunted code mansion...",
  "Dropping the beat for your code to dance...",
  "Lighting a bonfire under your code for some warmth...",
  "Transforming your code caterpillar into a beautiful butterfly...",
  "Defrosting your frozen code in the AI microwave...",
  "Tasting the flavors of your delicious code recipe...",
  "Capturing the flag in your code battleground...",
  "Soaring over the peaks and troughs of your code landscape...",
  "Setting up a hammock in your code paradise...",
  "Drafting a blueprint for your code construction project...",
  "Navigating the twists and turns of your labyrinthine code...",
];

let lockedFileDecorations = [

  vscode.window.createTextEditorDecorationType({
    color: "#602ae0", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#602ae0", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.9",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#602ae0", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#FFFFFF", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#FFFFFF", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.9",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#FFFFFF", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#71C6A8", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#71C6A8", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.9",
  }),
  vscode.window.createTextEditorDecorationType({
    color: "#71C6A8", // This color will be used in the overview ruler as the color for the "marker
    opacity: "0.7",
  }),
];

export function getRandomProgressMessage() {
  return PROGRESS_MESSAGES[
    Math.floor(Math.random() * PROGRESS_MESSAGES.length)
  ];
}

let CRAWL_SPEED = 13;
let SEGMENT_SIZE = 100;
let SEQUENCE_LENGTH = lockedFileDecorations.length * SEGMENT_SIZE;
let progressShift = 0;

export function lockDocument(document: vscode.TextDocument) {
  progressShift = (progressShift + CRAWL_SPEED) % SEQUENCE_LENGTH;

  //get all editors of this doc
  let editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document === document
  );

  for (let editor of editors) {
    //store decorations range assignments (mapping from decoration to ranges)
    let decorationsToRanges = new Map<number, vscode.Range[]>();

    let documentLengh = editor.document.getText().length;
    let characterIndex = 0;

    let wroteFirstSegment = false;
    while (characterIndex < documentLengh) {
      let shiftedCharacterIndex = (characterIndex + progressShift) % SEQUENCE_LENGTH;
      if (shiftedCharacterIndex % SEGMENT_SIZE === 0) {

        let decorationId = Math.floor(shiftedCharacterIndex / SEGMENT_SIZE) % lockedFileDecorations.length;
        

        if (!wroteFirstSegment) {
          let prevDecorationId = (decorationId - 1 + lockedFileDecorations.length) % lockedFileDecorations.length;
          decorationsToRanges.set(prevDecorationId, [
            new vscode.Range(document.positionAt(0), document.positionAt(characterIndex)),
            ...(decorationsToRanges.get(prevDecorationId) || []),
          ]);
          wroteFirstSegment = true;
        }

        decorationsToRanges.set(decorationId, [
          new vscode.Range(document.positionAt(characterIndex), document.positionAt(Math.min(characterIndex + SEGMENT_SIZE, documentLengh))),
          ...(decorationsToRanges.get(decorationId) || []),
        ]);
        characterIndex += SEGMENT_SIZE;
      } else {
        characterIndex += 1;
      }
    }

    lockedFileDecorations.forEach((decoration, index) => {
      editor.setDecorations(decoration, decorationsToRanges.get(index) || []);
    });
  }

  return () => {
    editors.forEach((editor) => {
      lockedFileDecorations.forEach((decoration, index) => {
        editor.setDecorations(decoration, []);
      });
    });
  };
}
