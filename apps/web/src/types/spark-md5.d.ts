declare module 'spark-md5' {
  const SparkMD5: {
    ArrayBuffer: {
      hash(arr: ArrayBuffer): string;
    };
  };

  export default SparkMD5;
}
