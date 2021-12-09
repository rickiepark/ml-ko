/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as argparse from 'argparse';
import * as fs from 'fs';
import * as path from 'path';
import * as shelljs from 'shelljs';

// `--gpu` 플래그 지정에 따라 동적으로 tf를 임포트합니다.
let tf;

import {FashionMnistDataset, MnistDataset} from './data_mnist';
import {createModel as createMnistModel} from './model_mnist';
import {createModel as createFashionMnistModel} from './model_fashion_mnist';

function parseArgs() {
  const parser = new argparse.ArgumentParser({
    description: 'TensorFlow.js 양자화 예제: MNIST 모델 평가하기',
    addHelp: true
  });
  parser.addArgument('dataset', {
    type: 'string',
    help: '데이터셋 이름({mnist, fashion-mnist}).'
  });
  parser.addArgument('--epochs', {
    type: 'int',
    defaultValue: 100,
    help: '모델을 훈련할 에포크 횟수'
  });
  parser.addArgument('--batchSize', {
    type: 'int',
    defaultValue: 128,
    help: '훈련에 사용할 배치 크기'
  });
  parser.addArgument('--validationSplit', {
    type: 'float',
    defaultValue: 0.15,
    help: '훈련에 사용할 검증 세트 비율'
  });
  parser.addArgument('--modelSavePath', {
    type: 'string',
    defaultValue: './models/',
    help: '평가할 모델을 저장할 경로'
  });
  parser.addArgument('--gpu', {
    action: 'storeTrue',
    help: 'tfjs-node-gpu를 사용해 평가합니다(CUDA 가능 GPU, 지원 드라이버와 라이브러리가 필요).'
  });
  return parser.parseArgs();
}

async function main() {
  const args = parseArgs();
  if (args.gpu) {
    tf = require('@tensorflow/tfjs-node-gpu');
  } else {
    tf = require('@tensorflow/tfjs-node');
  }

  let dataset;
  let model;
  if (args.dataset === 'fashion-mnist') {
    dataset = new FashionMnistDataset();
    model = createFashionMnistModel();
  } else if (args.dataset === 'mnist') {
    dataset = new MnistDataset();
    model = createMnistModel();
  } else {
    throw new Error(`Unrecognized dataset name: ${args.dataset}`);
  }
  await dataset.loadData();
  const {images: trainImages, labels: trainLabels} = dataset.getTrainData();

  model.summary();

  await model.fit(trainImages, trainLabels, {
    epochs: args.epochs,
    batchSize: args.batchSize,
    validationSplit: args.validationSplit,
    callbacks: tf.callbacks.earlyStopping({patience: 20})
  });

  const {images: testImages, labels: testLabels} = dataset.getTestData();
  const evalOutput = model.evaluate(testImages, testLabels);

  console.log(
      `\n평가 결과:\n` +
      `  손실 = ${evalOutput[0].dataSync()[0].toFixed(6)}; `+
      `정확도 = ${evalOutput[1].dataSync()[0].toFixed(6)}`);

  const modelSavePath = path.join(args.modelSavePath, args.dataset, 'original');
  if (modelSavePath != null) {
    if (!fs.existsSync(path.dirname(modelSavePath))) {
      shelljs.mkdir('-p', path.dirname(modelSavePath));
    }
    await model.save(`file://${modelSavePath}`);
    console.log(`모델 저장 경로: ${modelSavePath}`);
  }
}

if (require.main === module) {
  main();
}
