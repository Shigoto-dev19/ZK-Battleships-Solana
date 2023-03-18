const process = require("process");
import chalk from 'chalk';
import figlet from 'figlet';
import { prompt } from "enquirer";
import { INSTRUCTIONS, HELPER, WELCOME, salmon } from './instructions';
import { BattleShipClient } from '../../src/battleshipClient';
import * as anchor from '@project-serum/anchor';
import { AnchorError, Program } from '@project-serum/anchor';
import { ZkBattleship } from '../../target/types/zk_battleship';
import { hostGame, joinGame, hostAttack, joinerAttack} from './game';
import { Spinner } from 'clui';
import { isCoordinateValid, parseCoordinates } from './validateCoords';


process.env.ANCHOR_PROVIDER_URL = "http://127.0.0.1:8899";
process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";

let program: Program<ZkBattleship>;
let game_publicKey;
let gameState;
let host;
let playerOne
let joiner;
let playerTwo;

// x, y, z (horizontal/ verical orientation) ship placements
// x, y, z (horizontal/ verical orientation) ship placements
const game2_boards = {
    player1: [
        ["4", "2", "1"],
        ["1", "1", "0"],
        ["8", "6", "1"],
        ["3", "9", "0"],
        ["6", "3", "1"]
    ],
    player2: [
        ["1", "8", "0"],
        ["0", "3", "1"],
        ["3", "1", "1"],
        ["8", "5", "1"],
        ["8", "9", "0"]
    ]
  }

/* Clears Term & ASCII ART! */
function clearTerm(menuCallback, init?) {
    process.stdout.write('\x1Bc');
    console.log(
        chalk.cyan(
            figlet.textSync('ZKBattleship CLI', {
                font: 'Graffiti',
                horizontalLayout: 'full'
            }),
            '\n'
        )
    );

    init ? menuCallback('init') : menuCallback();
}

async function mainMenu(init) {

    const WELCOME = ' Welcome to ZKBattleship CLI!';
    const MENU = ' ZKBattleship CLI Menu:';
    const MESSAGE = !init ? MENU : WELCOME;

    const question = 
        {   
            type: 'select',
            name: 'command',
            message: MESSAGE,
            choices: [' Host Game', ' Join Game', ' See Instructions', ' Exit'],
            default: 0
        }
 
   const answer = await prompt(question);
   let choice = await answer;
   
    switch (choice.command) {

        case ' See Instructions':
            console.log(INSTRUCTIONS)
            __continue(() => {
                clearTerm(mainMenu);
            });
            break;
        case ' Host Game':
            clearTerm(hostMenu);
            break;
        case ' Join Game':
            clearTerm(joinerMenu);
            break;
        case ' Exit':
            console.log('\n\nGoodbye...\n\n');
            process.exit();
            break;
    }
}

function hostMenu() {
    const questions = 
        {
            type: 'select',
            name: 'selection',
            message: ' Options:',
            choices: [ ' Create New Game', ' Attack', ' Main Menu'],
            default: 0
        }
    
    prompt(questions).then(menu => {
        switch (menu.selection) {
            case ' Create New Game':
                hostGame(game2_boards.player1).then((result) => {
                    let{ _host, _gameState, _gamePK, _program, _playerOne } = result
                    host = _host
                    gameState = _gameState
                    game_publicKey = _gamePK
                    program = _program
                    playerOne = _playerOne
                    host.printBoards()
                })
                
                clearTerm(hostMenu);
                break;
            case ' Attack':
                promptHostShot(host);
                host.printGameData(gameState)
                clearTerm(hostMenu);
                break;
            default:
                clearTerm(mainMenu);
        }
    });
}

function joinerMenu() {
    const questions = 
        {
            type: 'select',
            name: 'selection',
            message: ' Options:',
            choices: [ ' Join Game', ' Attack', ' Main Menu'],
            default: 0
        }
    
    prompt(questions).then(menu => {
        switch (menu.selection) {
            case ' Join Game':
                joinGame(game2_boards.player2, game_publicKey).then((result) => {
                    let {_joiner, _playerTwo, _program, _gameState} = result
                    joiner = _joiner
                    playerTwo = _playerTwo
                    program = _program
                    gameState = _gameState
                    joiner.printBoards()
                })
                clearTerm(joinerMenu);
                break;
            case ' Attack':
                joiner.printBoards(gameState)
                promptJoinerShot(joiner)
                joiner.printGameData(gameState)
                clearTerm(joinerMenu);
                break;
            default:
                clearTerm(mainMenu);
        }
    });
}

function promptHostShot(client) {
    if (client.winner) {
        return gameOver();
    }
    const question = [
        {
            type: 'input',
            name: 'coords',
            message: ` Take a guess! Enter coordinates A0-${'I9'}: ${chalk.dim('(e.g. B7)')}`,
            validate: value => {
                return commandCenter(value, () => {
                    if (isCoordinateValid(value, 10)) {
                        return true;
                    } else {
                        return "Please enter valid coordinates"
                    }
                });
            }
        }
    ];
  
    prompt(question).then(move => {
        clearTerm(() => {
            console.log(HELPER);
            let {row, col} = parseCoordinates(move.coords);
            hostAttack(program, playerOne, host, game_publicKey, [col, row]).then((result) => {
                gameState = result
            })
            __continue(() => {
                fetchAccountEvery3Seconds(game_publicKey).then(() => {
                });
            });
        });
    })
}

function promptJoinerShot(client) {
    if (client.winner) {
        return gameOver();
    }
  
    const question = [
        {
            type: 'input',
            name: 'coords',
            message: ` Take a guess! Enter coordinates A0-${'I9'}: ${chalk.dim('(e.g. B7)')}`,
            validate: value => {
                return commandCenter(value, () => {
                    if (isCoordinateValid(value, 10)) {
                        return true;
                    } else {
                        return "Please enter valid coordinates"
                    }
                });
            }
        }
    ];
  
    prompt(question).then(move => {
        clearTerm(() => {
            console.log(HELPER);
            let {row, col} = parseCoordinates(move.coords);
            joinerAttack(program, playerTwo, joiner, game_publicKey, [col, row]).then((result) => {
                let {_gameState, _joiner} = result
                gameState = gameState
                joiner = _joiner
            })
            joiner.printBoards(gameState)
            __continue(() => {
                fetchAccountEvery3Seconds(game_publicKey).then(() => {
                });
            });
        });
    })
}

function gameOver() {

const question = [
    {
        type: 'select',
        name: 'newGame',
        message: 'The game is not yet initialized!',
        choices: [' Yes!', ' Main Menu', ' Exit'],
        default: 0
    }
];

prompt(question).then(answer => {
    const spinner = new Spinner('');
    switch (answer.newGame) {
        case ' Yes!':
            console.log('   Ready? Here we go again...');
            spinner.start();
            setTimeout(() => {
                spinner.stop();
                clearTerm(() => {
                });
            }, 1000);
            break;
        case ' Main Menu':
            clearTerm(mainMenu);
            break;
        default:
            console.log('\n\nThanks for playing Battleship CLI! Goodbye!\n\n');
            process.exit();
        }
    });
} 

/* UTILITY FUNCTIONS: */
function commandCenter(value, validations) {
    switch (value) {
        case 'help':
            return INSTRUCTIONS;
        // case 'show score':
        //     return game.status;
        case 'q':
        case 'quit':
            console.log('\n\nGoodbye...');
            process.exit();
        default:
            return validations();
    }
}

function __continue(callback) {
    const question = [
        {
            type: 'input',
            name: 'continue',
            message: ' Press enter to continue',
            validate: value => {
                return commandCenter(value, () => {
                    return true;
                });
            }
        }
    ];

    prompt(question).then(callback);
}

async function fetchAccountEvery3Seconds(game_publicKey) {

    function wait(ms: number): Promise<void> {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, ms);
        });
      }
    console.log('Waiting for the enemy to play his turn!');
    const spinner = new Spinner('');
    spinner.start();
    let gameState = await program.account.game.fetch(game_publicKey);
    let turns = gameState.turns;

    while (!turns == turns + 1) {
        gameState = await program.account.game.fetch(game_publicKey);
        turns = gameState.turns;
        await wait(3000);
    }
    spinner.stop();
    console.log('You are ready to attack!');
  }
  
clearTerm(mainMenu, 'init');
