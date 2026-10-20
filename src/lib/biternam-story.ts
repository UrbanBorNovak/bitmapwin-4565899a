/**
 * BITERNAM — Part 1 backstory. Original parody fiction for the Biternam pilot;
 * every name, line and epigraph is invented (no real people, no real quotes).
 */
export type StoryChapter = { title: string; epigraph: string; source: string; body: string[] };

export const BITERNAM_PART_1: { title: string; tagline: string; chapters: StoryChapter[] } = {
  title: "Part 1: What Rex Nonce Knew",
  tagline: "In which we learn that Marshal Rex Nonce does not have only friends.",
  chapters: [
    {
      title: "The law around here",
      epigraph: "The chain doesn't forget. Neither do I.",
      source: "Sheriff Ledger, A Fistful of Sats (unreleased)",
      body: [
        "Name's Rex Nonce. Marshal, to people who owe me money. My job is simple: when somebody double-spends outside the safe zone, I find them. When somebody empties a cold wallet that wasn't theirs, Rex Nonce and his hover-skiff follow the trail. Most of those trails end at a block explorer, and the block explorer never lies.",
        "My jacket holds 254 commendations from the Orion Hashrate Authority. Not one pay rise. I blame Vex Dust.",
        "If you know Vex Dust, you're either in a mempool cell or in the orphan-block cemetery. Vex doesn't bring a pen to a bank. Vex brings a botnet and forty thousand dust outputs, and he stuffs the blocks until the vault doors give up. I've chased him for two years across every corner of the galaxy. He keeps slipping out of the net. The only thing that warms my heart: I don't like him, and he truly hates me. Healthy.",
      ],
    },
    {
      title: "The art of product placement",
      epigraph: "Read the fine print, kid. It's inscribed.",
      source: "Detective Satpoint, The Big Reorg (unreleased)",
      body: [
        "Home from a mission, the usual half-ton of fee bumps was waiting for me. Under them was a golden envelope with a glowing QR code. I scanned it. A smiling hostess filled the screen. I'd won a free week at BITERNAM, the greatest on-chain resort in the known galaxy.",
        "BITERNAM belongs to Mr. Funn, CEO of H.O.D.L. Leisure (Heritage Of Digital Landmarks), whose theme-planets turn every famous Bitcoin block into an attraction. Genesis Gardens. The Pizza Pavilion. Halving Heights. Advice: H.O.D.L. stock trades at 21 sats. At that price it's practically a gift.",
      ],
    },
    {
      title: "The peace of the peoples",
      epigraph: "Never trust a deal signed after the third round.",
      source: "Old miner's proverb (invented)",
      body: [
        "Block space was crowded. The descendants of Old Earth were stacked ten to a node on Orion. When the government asked where to build the first theme-planets, a bright clerk noticed that the Mempoolers, an ancient race of transaction-hoarders, lived on only a sixth of their world.",
        "There was a mega-party. There was a great deal of Herpetos, a liquor whose only side effect is reciting the whitepaper from memory. By dawn, Odomaxx, King of the Mempoolers, had traded away his planet for a crate of mining rigs and one sacred book: The Secret of Low Fees. Business schools call that a bargain. So do I.",
      ],
    },
    {
      title: "The disillusion",
      epigraph: "Where there's block reward, there are vultures.",
      source: "Marshal Rex Nonce (he says it a lot)",
      body: [
        "The Mempoolers' morning after was painful. Bulldozers poured BITERNAM's foundations over their homes, and they retreated to one last island, dreaming of revenge.",
        "Vex Dust smelled opportunity. He called himself an 'interactive terrorist', sailed to the island and promised the Mempoolers glory, power and unlimited unconfirmed transactions. They made him a god.",
      ],
    },
    {
      title: "The point of frequenting saloons",
      epigraph: "One more round. I'm paying in testnet coins.",
      source: "Patron, Satoshi's Saloon (invented)",
      body: [
        "I was halfway through the welcome video when Jed, a police informant, burst into my apartment. Vex had been seen at Satoshi's Saloon with Mr. Grubb, owner of sixty-two rival planetoparks, including the famous Double Spend Diner.",
        "Grubb slid him a cold wallet stuffed with credits and mentioned Mr. Funn's name more than once. Grubb and Funn have hated each other since the Fee Wars. Then Vex said my name and added his full vocabulary: 'I'll get you, Nonce.' From him, that's practically a love letter. By the time I got there, the bird had flown.",
      ],
    },
    {
      title: "The point of taking vacations",
      epigraph: "Sunscreen is not a security model.",
      source: "BITERNAM safety brochure (invented)",
      body: [
        "Stepping off the shuttle, I saw the brochure hadn't lied. BITERNAM was an oasis of culture and calm: kids posing with a Genesis animatronic, two armoured knights duelling over a disputed UTXO.",
        "In the changing room I picked the barbarian outfit. Very chic on a sunny morning. An old wound from Vex started throbbing. When I stepped out, the whole park had gone silent. Tourists, knights, shuttles: all gone.",
      ],
    },
    {
      title: "The surprise visit",
      epigraph: "Peekaboo is not an incident response plan.",
      source: "Tracy-9's performance review (invented)",
      body: [
        "Tracy was the best operator in BITERNAM's control mall. Smart, fast, and unbeatable at the fee calculator. That morning she came back to her desk and found the control room full of Mempoolers. Harold, the jealous manager of the High-Tech Zone, was typing a virus into the main node while the other operators sat tied up.",
        "Nobody noticed Tracy. She closed the door, walked to the transcoding room, put on the helmet, glowed, and vanished into the park's node network. 'Girl,' she told herself, 'you're a Translated Network Intelligence now. That'll look great on the CV.' She became Tracy-9.",
      ],
    },
    {
      title: "When the operator gets involved",
      epigraph: "Don't scare the tourist. Then tell him everything.",
      source: "Tracy-9, internal memo",
      body: [
        "Vex's interceptor landed. The Mempoolers bowed, which is hard for a reptile. Harold's virus started eating the park's data (advice: never eat data). Soon BITERNAM would seal its gates for good, with Rex Nonce locked inside.",
        "Then a young Mempooler ran in, out of breath: 'Master Vex, Nonce has vanished from the sensors!' Somewhere in the network, an operator was hiding him. The Mempoolers remembered their prophecy: 'Two smooth-skins will come. They will fight. And the fees will fall.'",
        "Tracy-9 found the barbarian on a monitor and decided to play it cool: let him think it was just a regular adventure, then tell him the truth. 'Hello,' she whispered on his wrist. 'I'm Tracy.' Before he could answer, Vex's face filled the screen: 'I'll get you, Nonce!'",
        "So now you know the plan, Inspector. Your turn.",
      ],
    },
  ],
};
