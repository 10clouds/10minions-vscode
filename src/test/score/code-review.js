// background info
// All functions are pure
// checkInput has only one parameter
// req,res - node-like request and response
// getInputValues returns an array
// getCheckboxValues returns object like {a: boolean, b: boolean}

// Code submitted for review
function checkForm(req, res) {
    const a = getCheckboxValues(req).a;
    const b = getCheckboxValues(req).b;
    let showMessage = false;
  
    for (let x of getInputValues(req)) {
      if (!(!a && !b) && checkInput(x)) {
        showMessage = true;
      }
    }
  
    res.send({ showMessage });
  }