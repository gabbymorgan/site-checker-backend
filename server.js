const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const puppeteer = require('puppeteer');
const getCSS = require('get-css');
const caniuse = require('caniuse-api');
const PORT = process.env.PORT || 5000;


const server = express();
const corsOptions = {
    origin: true,
    methods: ['GET, POST'],
};

server.use(cors(corsOptions));
server.use(helmet());
server.use(morgan());
server.use(bodyParser.json());

function checkCSS(result) {
  const styles = result.css.split(/[{};]/).filter(line => {
    return line.includes(':');
  });
  const attributes = styles.map(block =>{
    return block.split(':')[0];
  }).filter(attribute => {
    return caniuse.find(attribute).length;
  });
  const values = styles.map(block => {
    return block.split(':')[1];
  });
  return attributes.map(attr =>{
    try {
      return {attr, support: caniuse.getSupport(attr)};
    } catch(e) {
      return {attr, support: null};
    }
  });
}

server.get('/scrape', (req, res) => {
  if (req.query) {
  const { url } = req.query;
  console.log(url);
  puppeteer.launch()
    .then(async browser => {
      const styles = await getCSS(url);
      const compatibilities = checkCSS(await styles);
      const page = await browser.newPage();
      await page.goto(url);

      let links = await page.evaluateHandle(() => {
        return Array.from(document.getElementsByTagName('a')).map(a => a.href);
      });

      let brokenImages = await page.evaluateHandle(() => {
        return Array.from(document.getElementsByTagName('img')).filter(image => {
          return !image.naturalHeight;
        }).map(img => img.src);
      });
      
      links = await links.jsonValue();
      brokenImages = await brokenImages.jsonValue();
      await browser.close();
      res.status(200).json({links, brokenImages, compatibilities});
    }).catch(err => {
      console.log(err);
      res.status(500).json({ message: 'Request is failing in the puppeteer function.'});
    });
  } else {
    res.status(300).json({message: "Requests must include a url."})
  }
});

server.listen(PORT)
console.log(`Magic happens on ${PORT}`);
exports = module.exports = server;
