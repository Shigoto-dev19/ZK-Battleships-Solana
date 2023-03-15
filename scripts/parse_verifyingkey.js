var ffjavascript = require("ffjavascript");
const { unstringifyBigInts, leInt2Buff } = ffjavascript.utils;
var fs = require("fs");
const { argv } = require("process");


async function main() {
  let nrInputs = argv[2];
  if (!nrInputs) {
    throw new Error("circuit nrInputs not specified");
  }

  let program = "";
  if (nrInputs == "2") {
    program = "verifier_program_zero";
  } else if (nrInputs == "10") {
    program = "verifier_program_one";
  } else if (nrInputs == "4") {
    program = "verifier_program_two";
  } else if (nrInputs == "app") {
    program = `${argv[3]}`;
  } else {
    throw new Error("invalid nr of inputs");
  }

  console.log = () => {};

  let file = await fs.readFile(`./circuits/artifacts/${argv[4]}_verification_key.json`, async function (err, fd) {
    if (err) {
      return console.error(err);
    }
    console.log("File opened successfully!");
    var mydata = JSON.parse(fd.toString());
    console.log(mydata);

    for (var i in mydata) {
      if (i == "vk_alpha_1") {
        for (var j in mydata[i]) {
          mydata[i][j] = leInt2Buff(
            unstringifyBigInts(mydata[i][j]),
            32
          ).reverse();
        }
      } else if (i == "vk_beta_2") {
        for (var j in mydata[i]) {
          console.log("mydata[i][j] ", mydata[i][j]);

          let tmp = Array.from(
            leInt2Buff(unstringifyBigInts(mydata[i][j][0]), 32)
          )
            .concat(
              Array.from(leInt2Buff(unstringifyBigInts(mydata[i][j][1]), 32))
            )
            .reverse();
          console.log("tmp ", tmp);
          mydata[i][j][0] = tmp.slice(0, 32);
          mydata[i][j][1] = tmp.slice(32, 64);
          console.log("mydata[i][j] ", mydata[i][j]);   
        }
      } else if (i == "vk_gamma_2") {
        for (var j in mydata[i]) {
          let tmp = Array.from(
            leInt2Buff(unstringifyBigInts(mydata[i][j][0]), 32)
          )
            .concat(
              Array.from(leInt2Buff(unstringifyBigInts(mydata[i][j][1]), 32))
            )
            .reverse();
          console.log(`i ${i}, tmp ${tmp}`);
          mydata[i][j][0] = tmp.slice(0, 32);
          mydata[i][j][1] = tmp.slice(32, 64);
        }
      } else if (i == "vk_delta_2") {
        for (var j in mydata[i]) {
          let tmp = Array.from(
            leInt2Buff(unstringifyBigInts(mydata[i][j][0]), 32)
          )
            .concat(
              Array.from(leInt2Buff(unstringifyBigInts(mydata[i][j][1]), 32))
            )
            .reverse();
          mydata[i][j][0] = tmp.slice(0, 32);
          mydata[i][j][1] = tmp.slice(32, 64);

        }
      } else if (i == "vk_alphabeta_12") {
        for (var j in mydata[i]) {
          for (var z in mydata[i][j]) {
            for (var u in mydata[i][j][z]) {
              mydata[i][j][z][u] = leInt2Buff(
                unstringifyBigInts(mydata[i][j][z][u])
              );
            }
          }
        }
      } else if (i == "IC") {
        for (var j in mydata[i]) {
          for (var z in mydata[i][j]) {
            console.log(unstringifyBigInts(mydata[i][j][z]));
            console.log(
              unstringifyBigInts(mydata[i][j][z]) ==
                unstringifyBigInts(
                  "0x279A3A31DB55A7D9E82122ADFD708F5FF0DD33706A0404DD0E6EA06D9B83452E"
                )
            );
            console.log(
              unstringifyBigInts(mydata[i][j][z]) ==
                unstringifyBigInts(
                  "0x2875717270029F096FEC64D14A540AAD5475725428F790D6D848B32E98A81FBE"
                )
            );

            if (z == 1) {
            }
            mydata[i][j][z] = leInt2Buff(
              unstringifyBigInts(mydata[i][j][z]),
              32
            ).reverse();
          }
        }
      }
    }

    let path = "./programs/" + argv[3] + `/src/${argv[4]}_verifying_key.rs`;
    console.log(path);
    let resFile = await fs.openSync(path, "w");

    let s = `use groth16_solana::groth16::Groth16Verifyingkey;\n\npub const VERIFYINGKEY${argv[4].toUpperCase()}: Groth16Verifyingkey =  Groth16Verifyingkey {\n\tnr_pubinputs: ${mydata.IC.length},\n\n`;
    s += "\tvk_alpha_g1: [\n";
    for (var j = 0; j < mydata.vk_alpha_1.length - 1; j++) {
      console.log(typeof mydata.vk_alpha_1[j]);
      s +=
        "\t\t" +
        Array.from(mydata.vk_alpha_1[j]) /*.reverse().toString()*/ +
        ",\n";
    }
    s += "\t],\n\n";

    fs.writeSync(resFile, s);
    s = "\tvk_beta_g2: [\n";
    for (var j = 0; j < mydata.vk_beta_2.length - 1; j++) {
      for (var z = 0; z < 2; z++) {
        s +=
          "\t\t" +
          Array.from(mydata.vk_beta_2[j][z]) /*.reverse().toString()*/ +
          ",\n";
      }
    }
    s += "\t],\n\n";
    fs.writeSync(resFile, s);

    s = "\tvk_gamme_g2: [\n";
    for (var j = 0; j < mydata.vk_gamma_2.length - 1; j++) {
      for (var z = 0; z < 2; z++) {
        s +=
          "\t\t" +
          Array.from(mydata.vk_gamma_2[j][z]) /*.reverse().toString()*/ +
          ",\n";
      }
    }
    s += "\t],\n\n";
    fs.writeSync(resFile, s);

    s = "\tvk_delta_g2: [\n";
    for (var j = 0; j < mydata.vk_delta_2.length - 1; j++) {
      for (var z = 0; z < 2; z++) {
        s +=
          "\t\t" +
          Array.from(mydata.vk_delta_2[j][z]) /*.reverse().toString()*/ +
          ",\n";
      }
    }
    s += "\t],\n\n";
    fs.writeSync(resFile, s);
    s = "\tvk_ic: &[\n";
    let x = 0;
    console.log("mydata.IC, ", mydata.IC);
    for (var ic in mydata.IC) {
      s += "\t\t[\n";
      // console.log(mydata.IC[ic])
      for (var j = 0; j < mydata.IC[ic].length - 1; j++) {
        s += "\t\t\t" + mydata.IC[ic][j] /*.reverse().toString()*/ + ",\n";
      }
      x++;
      s += "\t\t],\n";
    }
    s += "\t]\n};";

    console.log("Public inputs", x);
    fs.writeSync(resFile, s);
    
  });

}

main();